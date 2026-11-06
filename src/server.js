import 'dotenv/config';
import express from 'express';
import { isValidServiceCredential, buildPatientUrl } from './security.js';
import { checkRateLimit, rateLimitHeaders } from './rateLimit.js';
import { safeLog } from './redact.js';
import {
  isMinor,
  guardianConsentRequired,
  guardianNoticeText,
  GUARDIAN_CONSENT_PURPOSE,
  GUARDIAN_NOTICE_VERSION,
} from './ageGate.js';
import path from 'node:path';
import fs from 'node:fs';
import {
  createSession, getSession, saveSession, saveOutput, getOutput,
  getSessionByPatientToken, revokePatientToken, redeemPatientToken,
  appendConsentEvent, hasActiveConsent, createErasureCase, getErasureCase, finalizeErasureCase
} from './store.js';
import { nextStep, consolidate, nextFollowUp } from './ai.js';
import {
  SITE_QUESTION, FIXED_SETS, MAX_AI_QUESTIONS, siteOf, nextFixedQuestion,
  questionDef, inputSpec, resolveAnswer, localizeQuestion, answerHelper
} from './flow.js';
import { getSpecialtyModule } from './specialties/index.js';

const app = express();
app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (req.path.startsWith('/api/patient/') || req.path.startsWith('/s/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

const publicRoots = [
  path.join(process.cwd(), 'public'),
  path.resolve('public'),
  path.resolve('src', '..', 'public'),
  path.join(path.resolve('src'), '..', 'public'),
];

function resolvePublic(...parts) {
  for (const root of publicRoots) {
    const full = path.join(root, ...parts);
    try { if (fs.existsSync(full)) return full; } catch {}
  }
  return null;
}

for (const root of publicRoots) {
  try { if (fs.existsSync(root)) app.use(express.static(root)); } catch {}
}

const PATIENT_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f766e">
<title>AI Clinical Screening</title>
<link rel="stylesheet" href="/screening.css">
</head>
<body>
<main class="shell"><div id="app" class="card"></div></main>
<script src="/app.js"></script>
</body>
</html>
`;

function servePatientPage(_req, res) {
  const file = resolvePublic('index.html');
  if (file) {
    try { return res.type('html').send(fs.readFileSync(file, 'utf8')); } catch {}
  }
  return res.type('html').send(PATIENT_PAGE_HTML);
}

function serveStaticAsset(name, contentType) {
  return (_req, res) => {
    const file = resolvePublic(name);
    if (file) {
      try { res.type(contentType).send(fs.readFileSync(file, 'utf8')); return; } catch {}
    }
    res.status(404).type('text').send('Not Found');
  };
}

function applyRateLimit(req, res, scope, id, limit = 30) {
  const result = checkRateLimit({ scope, id, limit, windowMs: 60_000 });
  const headers = rateLimitHeaders(result);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (!result.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(result.resetMs / 1000)));
    res.status(429).json({ error: 'Too many requests. Please retry shortly.' });
    return false;
  }
  return true;
}

const SCREENING_CONSENT_PURPOSE = 'pre_consultation_clinical_screening_and_sharing_with_treating_clinic';
const SCREENING_CONSENT_VERSION = 'screening-notice-2026-11-v2';
const PATIENT_SESSION_COOKIE = 'screening_session';

const port = Number(process.env.PORT || 3000);
const maxQuestions = () => Number(process.env.MAX_QUESTIONS || 12);

const SUPPORTED_UI_LANGS = new Set(['en','kn','hi','ta','te','ml','bn','or','as','mr','ur','bho','mai','ne','mni','brx']);
function normalizeUiLang(value) {
  const s = String(value || 'en').toLowerCase().trim();
  if (SUPPORTED_UI_LANGS.has(s)) return s;
  for (const c of SUPPORTED_UI_LANGS) {
    if (s === c || s.startsWith(c + '-') || s.startsWith(c + '_')) return c;
  }
  return 'en';
}

function normalizeSpecialty(value) {
  const s = String(value || '').toLowerCase().trim().replace(/\s+/g, '_').slice(0, 40);
  return s || 'ent';
}

function localizeForPatient(q, lang) {
  const loc = localizeQuestion(q, lang) || q;
  return { text: loc.text || q.text, options: loc.options || q.options || [] };
}

function normalizePhone(phone) {
  const raw = String(phone || '').replace(/\D/g, '');
  if (raw.length === 10) return '91' + raw;
  if (raw.length === 11 && raw.startsWith('0')) return '91' + raw.slice(1);
  return raw;
}

function whatsAppTemplateLanguage(preferred) {
  const envDefault = String(process.env.WA_COMPLAINT_TEMPLATE_LANGUAGE || 'en').trim() || 'en';
  const raw = String(preferred || envDefault || 'en').toLowerCase().trim().split(/[-_]/)[0];
  const allowed = new Set(['en', 'hi', 'kn', 'ta', 'te', 'ml', 'bn', 'mr', 'ur', 'gu', 'pa']);
  const hiFamily = new Set(['bho', 'mai', 'mni', 'brx', 'ne', 'as', 'or']);
  if (allowed.has(raw)) return raw;
  if (hiFamily.has(raw)) return 'hi';
  return envDefault;
}

async function sendComplaintLink(phone, patientUrl, preferredLang) {
  const phoneNumberId = String(process.env.WA_PHONE_NUMBER_ID || '').trim();
  const accessToken = String(process.env.WA_ACCESS_TOKEN || '').trim();
  const apiVersion = String(process.env.WA_API_VERSION || 'v21.0').trim();
  const templateName = String(process.env.WA_COMPLAINT_TEMPLATE_NAME || 'mediloop_add_complaints').trim();
  const languageCode = whatsAppTemplateLanguage(preferredLang);
  if (!phoneNumberId || !accessToken) return { ok: false, error: 'WhatsApp not configured' };
  const to = normalizePhone(phone);
  if (!to) return { ok: false, error: 'Patient phone number is invalid' };
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: patientUrl }] }],
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    safeLog('error', 'WhatsApp complaint link send failed', { status: response.status });
    return { ok: false, error: data?.error?.message || `WhatsApp API returned HTTP ${response.status}` };
  }
  return { ok: true, message_id: data?.messages?.[0]?.id || null };
}

function validInput(x) {
  return x && typeof x.patient_name === 'string' && x.patient_name.trim() &&
    Number.isInteger(x.age) && x.age > 0 && x.age < 130 &&
    typeof x.gender === 'string' && typeof x.complaint === 'string' && x.complaint.trim() &&
    typeof x.phone === 'string';
}

function publicOutput(output) {
  if (!output) return null;
  return { ...output, patient: output.patient ? { ...output.patient, phone: undefined } : output.patient };
}

function publicSession(s) {
  return {
    screening_id: s.screening_id,
    status: s.status,
    patient: {
      patient_name: s.patient.patient_name,
      age: s.patient.age,
      gender: s.patient.gender,
      complaint: s.patient.complaint,
      clinic_id: s.patient.clinic_id || null,
      clinic_name: s.patient.clinic_name || '',
      queue_token: s.patient.queue_token || null,
      waiting_ahead: s.patient.waiting_ahead ?? null,
      ui_language: s.patient.ui_language || 'en',
      requires_guardian_consent: Boolean(s.patient.requires_guardian_consent) || isMinor(s.patient.age),
    },
    question_count: s.question_count,
    conversation: (s.conversation || []).map(x => ({ role: x.role, message: x.message, at: x.at })),
    patient_token_expires_at: s.patient_token_expires_at,
    queue_status_url: queueStatusUrl(),
  };
}

function requestClinicId(req) {
  return String(req.headers['x-clinic-id'] || '').trim().slice(0, 120);
}

function validServerApiKey(req) {
  const authorization = String(req.headers.authorization || '').trim();
  const bearerKey = authorization.replace(/^Bearer\s+/i, '').trim();
  const suppliedKey = String(req.headers['x-api-key'] || bearerKey).trim();
  const managedRuntime = Boolean(
    process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' ||
    process.env.CF_PAGES || globalThis.Cloudflare || globalThis.__WORKER__
  );
  return isValidServiceCredential({
    clinicId: requestClinicId(req),
    suppliedKey,
    tenantKeysJson: process.env.SCREENING_CLINIC_API_KEYS_JSON,
    sharedKey: process.env.SCREENING_API_KEY,
    allowSharedKey: String(process.env.SCREENING_ALLOW_SHARED_API_KEY || '').toLowerCase() === 'true',
    managedRuntime,
  });
}

function patientUrl(req, token) {
  return buildPatientUrl(process.env.PATIENT_APP_URL, token, process.env.NODE_ENV);
}
function queueStatusUrl() {
  return 'https://mediloop-ai.tulasianand6.workers.dev/api/patient-queue';
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || '');
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0 || part.slice(0, i).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return ''; }
  }
  return '';
}

function setPatientSessionCookie(req, res, token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.CF_PAGES) ||
    Boolean(globalThis.Cloudflare) || Boolean(globalThis.__WORKER__) ||
    req.secure === true || forwardedProto === 'https';
  res.setHeader('Set-Cookie', `${PATIENT_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}

function clearPatientSessionCookie(res) {
  res.setHeader('Set-Cookie', `${PATIENT_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`);
}

async function getPatientContext(req, res, linkToken) {
  const candidate = String(linkToken || '').trim();
  if (candidate) {
    const redeemed = await redeemPatientToken(candidate);
    if (redeemed) {
      setPatientSessionCookie(req, res, redeemed.token, redeemed.expiresAt);
      return redeemed.session;
    }
    res.status(404).json({ error: 'This screening link is invalid, expired or already used.' });
    return null;
  }
  const cookieToken = readCookie(req, PATIENT_SESSION_COOKIE);
  const session = cookieToken ? await getSessionByPatientToken(cookieToken) : null;
  if (!session) {
    res.status(404).json({ error: 'No active screening session.' });
    return null;
  }
  return session;
}

function applyLanguage(s, body) {
  const lang = normalizeUiLang(body?.language || body?.ui_language || s.patient?.ui_language);
  const changed = Boolean(s.patient && s.patient.ui_language !== lang);
  if (s.patient) s.patient.ui_language = lang;
  return { changed, lang };
}

async function handlePatientSessionStart(req, res, linkToken) {
  try {
    const rlId = String(linkToken || readCookie(req, PATIENT_SESSION_COOKIE) || req.ip || 'anon').slice(0, 80);
    if (!applyRateLimit(req, res, 'patient-start', rlId, 40)) return;
    const s = await getPatientContext(req, res, linkToken);
    if (!s) return;
    if (s.status === 'consent_withdrawn') {
      return res.status(409).json({ error: 'Consent was withdrawn. Start a new screening if you wish to participate again.' });
    }

    const consentVersion = SCREENING_CONSENT_VERSION;
    const consentPurpose = SCREENING_CONSENT_PURPOSE;
    const alreadyConsented = await hasActiveConsent(s.screening_id, consentPurpose, consentVersion);
    const isNewConsent = req.body?.patient_consent === true && req.body?.consent_version === consentVersion;
    if (!alreadyConsented && !isNewConsent) {
      return res.status(403).json({
        error: 'Patient consent is required before screening can begin.',
        consent_required: true,
        consent_version: consentVersion,
        guardian_required: guardianConsentRequired(s.patient),
        guardian_notice: guardianConsentRequired(s.patient)
          ? guardianNoticeText(normalizeUiLang(s.patient?.ui_language))
          : null,
        guardian_purpose: GUARDIAN_CONSENT_PURPOSE,
        guardian_notice_version: GUARDIAN_NOTICE_VERSION,
      });
    }

    if (guardianConsentRequired(s.patient)) {
      const guardianOk = await hasActiveConsent(s.screening_id, GUARDIAN_CONSENT_PURPOSE, GUARDIAN_NOTICE_VERSION);
      const isNewGuardian = req.body?.guardian_consent === true &&
        req.body?.guardian_consent_version === GUARDIAN_NOTICE_VERSION;
      if (!guardianOk && !isNewGuardian) {
        return res.status(403).json({
          error: 'Parent or lawful guardian consent is required because the patient is under 18.',
          guardian_required: true,
          guardian_notice: guardianNoticeText(normalizeUiLang(s.patient?.ui_language)),
          guardian_purpose: GUARDIAN_CONSENT_PURPOSE,
          guardian_notice_version: GUARDIAN_NOTICE_VERSION,
          consent_version: consentVersion,
        });
      }
      if (isNewGuardian && !guardianOk) {
        await appendConsentEvent({
          screening_id: s.screening_id,
          event_type: 'granted',
          purpose: GUARDIAN_CONSENT_PURPOSE,
          notice_version: GUARDIAN_NOTICE_VERSION,
          language: normalizeUiLang(s.patient?.ui_language || req.body?.language),
          method: 'guardian_checkbox',
          channel: 'patient_screening_app',
          actor_type: 'guardian',
          evidence: {
            patient_age: s.patient?.age,
            relationship: String(req.body?.guardian_relationship || 'parent_or_lawful_guardian').slice(0, 80),
          },
        });
      }
    }

    const { changed, lang } = applyLanguage(s, req.body);
    if (isNewConsent && !alreadyConsented) {
      const consentEvent = await appendConsentEvent({
        screening_id: s.screening_id,
        event_type: 'granted',
        purpose: consentPurpose,
        notice_version: consentVersion,
        language: lang,
        method: 'affirmative_checkbox',
        channel: 'patient_screening_app',
        actor_type: 'patient',
        evidence: { consent_ui: 'patient_screening_app' },
      });
      const consentAt = consentEvent.occurred_at;
      if (!s.patient) s.patient = {};
      s.patient.screening_consent = {
        granted: true,
        at: consentAt,
        notice_version: consentVersion,
        language: lang,
        method: 'affirmative_checkbox',
        channel: 'patient_screening_app',
        purpose: consentPurpose,
      };
    }
    if (changed || (isNewConsent && !alreadyConsented)) await saveSession(s);

    if (s.status === 'submitted') {
      return res.json({ type: 'submitted', output: publicOutput(await getOutput(s.screening_id)) });
    }
    if (s.status === 'awaiting_review') {
      return res.json({ type: 'review', output: publicOutput(await getOutput(s.screening_id)) });
    }
    if (s.status !== 'in_progress') return res.status(409).json({ error: 'Screening is not available.' });

    // Minimal continue: ask first question path via existing flow modules if present
    return res.json({ type: 'ready', session: publicSession(s) });
  } catch (e) {
    safeLog('error', 'patient session start failed', { message: e?.message });
    return res.status(500).json({ error: 'Unable to start screening session.' });
  }
}

async function handlePatientSessionMessage(req, res, linkToken) {
  try {
    const rlId = String(linkToken || readCookie(req, PATIENT_SESSION_COOKIE) || req.ip || 'anon').slice(0, 80);
    if (!applyRateLimit(req, res, 'patient-message', rlId, 120)) return;
    const s = await getPatientContext(req, res, linkToken);
    if (!s) return;
    if (!(await hasActiveConsent(s.screening_id, SCREENING_CONSENT_PURPOSE, SCREENING_CONSENT_VERSION))) {
      return res.status(403).json({ error: 'Active consent required.' });
    }
    if (guardianConsentRequired(s.patient) &&
        !(await hasActiveConsent(s.screening_id, GUARDIAN_CONSENT_PURPOSE, GUARDIAN_NOTICE_VERSION))) {
      return res.status(403).json({ error: 'Guardian consent required for patients under 18.' });
    }
    return res.status(501).json({ error: 'Message handling uses the full flow module; deploy with complete server bundle.' });
  } catch (e) {
    safeLog('error', 'patient message failed', { message: e?.message });
    return res.status(500).json({ error: 'Unable to process message.' });
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ai-clinical-screening', compliance: {
    age_gate: true, rate_limit: true, redact: true,
    consent_ledger: true, guardian_purpose: GUARDIAN_CONSENT_PURPOSE,
  }});
});

app.get('/s/:token', servePatientPage);
app.get('/screening.css', serveStaticAsset('screening.css', 'text/css'));
app.get('/app.js', serveStaticAsset('app.js', 'application/javascript'));

app.post('/api/patient/s/:token/start', (req, res) => handlePatientSessionStart(req, res, req.params.token));
app.post('/api/patient/session/start', (req, res) => handlePatientSessionStart(req, res));
app.post('/api/patient/s/:token/message', (req, res) => handlePatientSessionMessage(req, res, req.params.token));
app.post('/api/patient/session/message', (req, res) => handlePatientSessionMessage(req, res));

app.post('/api/screenings', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
    const clinicKey = requestClinicId(req) || String(req.body?.clinic_id || 'unknown').slice(0, 80);
    if (!applyRateLimit(req, res, 'create-screening', clinicKey, 60)) return;
    if (!validInput(req.body)) {
      return res.status(400).json({ error: 'Invalid input JSON. Required: patient_name, age, gender, complaint, phone.' });
    }
    const clinic_id = String(req.body.clinic_id || '').trim().slice(0, 120) || null;
    if (!clinic_id || requestClinicId(req) !== clinic_id) {
      return res.status(403).json({ error: 'Authenticated clinic scope is required and must match the screening clinic.' });
    }
    const qt = String(req.body.queue_token || '').trim().slice(0, 20);
    const wa = Number.isInteger(req.body.waiting_ahead) && req.body.waiting_ahead >= 0 && req.body.waiting_ahead < 1000
      ? req.body.waiting_ahead : null;
    const specialty = normalizeSpecialty(req.body.specialty);
    const s = await createSession({
      ...req.body,
      specialty,
      clinic_id,
      queue_token: qt || null,
      waiting_ahead: wa,
      requires_guardian_consent: isMinor(req.body.age),
    });
    res.status(201).json({
      screening_id: s.screening_id,
      status: s.status,
      patient_url: patientUrl(req, s.patient_token),
      clinic_id: s.patient.clinic_id || null,
      queue_status_url: queueStatusUrl(),
      requires_guardian_consent: isMinor(req.body.age),
    });
  } catch (e) {
    safeLog('error', 'screening creation error', { message: e?.message });
    res.status(500).json({ error: 'Unable to create screening.' });
  }
});

app.get('/api/screenings/:id', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized' });
    const s = await getSession(req.params.id);
    if (!s || requestClinicId(req) !== String(s.patient?.clinic_id || '')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ ok: true, session: publicSession(s) });
  } catch (e) {
    safeLog('error', 'screening get failed', { message: e?.message });
    res.status(500).json({ error: 'Unable to load screening.' });
  }
});

app.get('/api/screenings/:id/output', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized' });
    const s = await getSession(req.params.id);
    if (!s || requestClinicId(req) !== String(s.patient?.clinic_id || '')) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!(await hasActiveConsent(s.screening_id, SCREENING_CONSENT_PURPOSE, SCREENING_CONSENT_VERSION))) {
      return res.status(403).json({ error: 'Active consent required to read output.' });
    }
    res.json({ ok: true, output: publicOutput(await getOutput(req.params.id)) });
  } catch (e) {
    safeLog('error', 'screening output failed', { message: e?.message });
    res.status(500).json({ error: 'Unable to load output.' });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`AI Clinical Screening listening on :${port}`);
  });
}

export default app;
