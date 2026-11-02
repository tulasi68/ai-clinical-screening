import 'dotenv/config';
import express from 'express';
import { isValidServiceCredential, buildPatientUrl } from './security.js';
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
// Step 5: specialty module registry. ENT is deliberately NOT registered —
// the ENT flow stays inline in continueBrowserSession() and is protected.
import { getSpecialtyModule } from './specialties/index.js';

const app = express();
app.use(express.json({ limit: '256kb' }));

// Patient screening pages and APIs contain health information and bearer tokens.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // All API responses may contain patient or clinical information, including
  // service-to-service screening reads. Never permit intermediary/browser caching.
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

// Resolve public assets from several possible roots (Node, Vercel, CF Workers VFS).
const publicRoots = [
  path.join(process.cwd(), 'public'),
  path.resolve('public'),
  path.resolve('src', '..', 'public'),
  path.join(path.resolve('src'), '..', 'public'),
];

function resolvePublic(...parts) {
  for (const root of publicRoots) {
    const full = path.join(root, ...parts);
    try {
      if (fs.existsSync(full)) return full;
    } catch {}
  }
  return null;
}

for (const root of publicRoots) {
  try {
    if (fs.existsSync(root)) app.use(express.static(root));
  } catch {}
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
    try {
      return res.type('html').send(fs.readFileSync(file, 'utf8'));
    } catch {}
  }
  return res.type('html').send(PATIENT_PAGE_HTML);
}

function serveStaticAsset(name, contentType) {
  return (_req, res) => {
    const file = resolvePublic(name);
    if (file) {
      try {
        res.type(contentType).send(fs.readFileSync(file, 'utf8'));
        return;
      } catch {}
    }
    res.status(404).type('text').send('Not Found');
  };
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

/** Step 4/5: specialty normaliser. Default is ALWAYS "ent". */
function normalizeSpecialty(value) {
  const s = String(value || '').toLowerCase().trim().replace(/\s+/g, '_').slice(0, 40);
  return s || 'ent';
}

/** Hard-coded localization only (flow.js TX / text_kn). No live API. */
function localizeForPatient(q, lang) {
  const loc = localizeQuestion(q, lang) || q;
  return {
    text: loc.text || q.text,
    options: loc.options || q.options || [],
  };
}

function normalizePhone(phone) {
  const raw = String(phone || '').replace(/\D/g, '');
  if (raw.length === 10) return '91' + raw;
  if (raw.length === 11 && raw.startsWith('0')) return '91' + raw.slice(1);
  return raw;
}

/** Map patient UI language → Meta WhatsApp template language code.
 *  Falls back to env WA_COMPLAINT_TEMPLATE_LANGUAGE, then en.
 *  Only codes Meta commonly supports for India templates are preferred.
 */
function whatsAppTemplateLanguage(preferred) {
  const envDefault = String(process.env.WA_COMPLAINT_TEMPLATE_LANGUAGE || 'en').trim() || 'en';
  const raw = String(preferred || envDefault || 'en').toLowerCase().trim().split(/[-_]/)[0];
  // Meta template language codes we can safely try (must be approved in BM)
  const allowed = new Set(['en', 'hi', 'kn', 'ta', 'te', 'ml', 'bn', 'mr', 'ur', 'gu', 'pa']);
  // Rare langs that share script/register with Hindi templates
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
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [{
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: patientUrl }]
        }]
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('WhatsApp complaint link send failed', { status: response.status });
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
  return {
    ...output,
    patient: output.patient ? { ...output.patient, phone: undefined } : output.patient
  };
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
    },
    question_count: s.question_count,
    conversation: (s.conversation || []).map(x => ({ role: x.role, message: x.message, at: x.at })),
    patient_token_expires_at: s.patient_token_expires_at,
    queue_status_url: queueStatusUrl(),
  };
}

async function finishForReview(s, reason) {
  const out = await consolidate(s);
  out.screening_id = s.screening_id;
  out.screening_status = (reason === 'urgent' || out.screening_status === 'urgent') ? 'urgent' : 'completed';
  out.patient_approved = false;
  out.submitted_at = null;
  await saveOutput(s.screening_id, out);
  s.status = 'awaiting_review';
  s.completed_at = new Date().toISOString();
  await saveSession(s);
  return out;
}

function progressOf(s) {
  const site = siteOf(s);
  if (!site || !FIXED_SETS[site]) return null;
  const asked = (s.conversation || []).filter(x => x.role === 'assistant' && x.qid && x.qid !== 'site').length;
  return { current: asked, total: FIXED_SETS[site].length + MAX_AI_QUESTIONS, fixed: FIXED_SETS[site].length };
}

function specialtyQuestionDef(s, qid) {
  const spec = normalizeSpecialty(s.patient?.specialty);
  if (spec && spec !== 'ent') {
    const mod = getSpecialtyModule(spec);
    if (mod && typeof mod.questionDef === 'function') {
      return mod.questionDef(s, qid);
    }
  }
  return questionDef(s, qid);
}

function questionPayload(s, entry) {
  const def = entry.qid ? specialtyQuestionDef(s, entry.qid) : null;
  const lang = normalizeUiLang(s.patient?.ui_language);

  if (!def) {
    return {
      type: 'question',
      message: entry.message,
      question_count: s.question_count,
      progress: progressOf(s),
      question: {
        id: entry.qid || 'free',
        text: entry.message,
        text_en: entry.message,
        kind: entry.kind || 'legacy',
        input: 'text',
        options: [],
      },
    };
  }

  const loc = localizeQuestion(def, lang);
  const spec = inputSpec(def);
  let options = (loc.options && loc.options.length)
    ? loc.options
    : (spec.options || []).map((o) => ({
        ...o,
        label: (lang === 'kn' && o.label_kn) ? o.label_kn : o.label,
      }));

  const displayText = entry.message || loc.text || def.text;

  return {
    type: 'question',
    message: displayText,
    question_count: s.question_count,
    progress: progressOf(s),
    question: {
      id: def.id,
      text: displayText,
      text_en: def.text,
      kind: entry.kind || 'fixed',
      input: spec.type,
      options,
    },
  };
}

async function askQuestion(s, q, kind) {
  const lang = normalizeUiLang(s.patient?.ui_language);
  const localized = localizeForPatient(q, lang);
  const entry = {
    role: 'assistant',
    message: localized.text,
    at: new Date().toISOString(),
    qid: q.id,
    kind,
    localized_options: localized.options,
  };
  if (kind === 'followup') {
    entry.question_def = { id: q.id, type: q.type || 'yes_no', text: q.text, text_kn: q.text_kn };
  }
  s.conversation.push(entry);
  s.question_count++;
  await saveSession(s);
  return questionPayload(s, entry);
}

function alreadyAnsweredQid(s, qid) {
  return (s.conversation || []).some((x) => x.role === 'patient' && x.qid === qid);
}

async function continueModuleSession(s, mod) {
  let next = null;
  if (typeof mod.nextQuestion === 'function') {
    next = mod.nextQuestion(s);
  } else if (Array.isArray(mod.questions)) {
    const helper = answerHelper(s);
    next = mod.questions.find((q) => {
      if (alreadyAnsweredQid(s, q.id)) return false;
      if (typeof q.showIf === 'function') {
        try { return Boolean(q.showIf(helper)); } catch { return true; }
      }
      return true;
    }) || null;
  }

  if (next) return askQuestion(s, next, 'fixed');

  const out = typeof mod.buildContract === 'function'
    ? await mod.buildContract(s)
    : await consolidate(s);

  out.screening_id = s.screening_id;
  out.screening_status = out.screening_status === 'urgent' ? 'urgent' : 'completed';
  out.patient_approved = false;
  out.submitted_at = null;
  await saveOutput(s.screening_id, out);
  s.status = 'awaiting_review';
  s.completed_at = new Date().toISOString();
  await saveSession(s);
  return { type: 'review', output: publicOutput(out) };
}

async function continueBrowserSession(s) {
  const spec = normalizeSpecialty(s.patient?.specialty);
  if (spec && spec !== 'ent') {
    const mod = getSpecialtyModule(spec);
    if (mod) return continueModuleSession(s, mod);
  }

  const site = siteOf(s);
  if (!site) {
    const last = s.conversation[s.conversation.length - 1];
    if (last && last.role === 'assistant' && last.qid === 'site') return questionPayload(s, last);
    return askQuestion(s, SITE_QUESTION, 'fixed');
  }

  if (FIXED_SETS[site]) {
    const q = nextFixedQuestion(s, site);
    if (q) return askQuestion(s, q, 'fixed');

    const f = await nextFollowUp(s, site);
    if (f) {
      return askQuestion(
        s,
        { id: f.qid, text: f.text, text_kn: f.text_kn, type: f.type || 'yes_no' },
        'followup'
      );
    }

    return { type: 'review', output: publicOutput(await finishForReview(s, 'completed')) };
  }

  if (s.question_count >= maxQuestions()) {
    return { type: 'review', output: publicOutput(await finishForReview(s, 'question_limit')) };
  }
  const step = await nextStep(s);
  if (step.status === 'QUESTION') {
    const entry = { role: 'assistant', message: step.message, at: new Date().toISOString() };
    s.conversation.push(entry);
    s.question_count++;
    await saveSession(s);
    return questionPayload(s, entry);
  }
  return {
    type: 'review',
    output: publicOutput(await finishForReview(s, step.status === 'URGENT' ? 'urgent' : 'completed')),
  };
}

function editableOutput(input, current) {
  const out = { ...current };
  if (typeof input?.summary === 'string') out.summary = input.summary.slice(0, 4000);
  out.screening_id = current.screening_id;
  out.screening_status = current.screening_status;
  out.patient_approved = false;
  out.submitted_at = null;
  return out;
}

function validServerApiKey(req) {
  const authorization = String(req.headers.authorization || '').trim();
  const bearerKey = authorization.replace(/^Bearer\s+/i, '').trim();
  const suppliedKey = String(req.headers['x-api-key'] || bearerKey).trim();
  const managedRuntime = Boolean(
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.CF_PAGES ||
    globalThis.Cloudflare ||
    globalThis.__WORKER__
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

function requestClinicId(req) {
  return String(req.headers['x-clinic-id'] || '').trim().slice(0, 120);
}

function serviceClinicMatches(req, session) {
  const requestedClinicId = requestClinicId(req);
  const storedClinicId = String(session?.patient?.clinic_id || '').trim();
  return Boolean(requestedClinicId && storedClinicId && requestedClinicId === storedClinicId);
}

function patientUrl(req, token) {
  // req intentionally unused: host headers must never select the bearer-link origin.
  return buildPatientUrl(process.env.PATIENT_APP_URL, token, process.env.NODE_ENV);
}
function queueStatusUrl() {
  // Use the live MediLoop queue endpoint. An old MEDILOOP_QUEUE_STATUS_URL
  // deployment variable can silently send patient pages to a stale API.
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
    // Do not let an invalid/revoked URL token silently select whatever patient
    // session happens to be in this browser's cookie jar.
    res.status(404).json({ error: 'This screening link is invalid, expired or already used.' });
    return null;
  }
  const cookieToken = readCookie(req, PATIENT_SESSION_COOKIE);
  const session = cookieToken ? await getSessionByPatientToken(cookieToken) : null;
  if (!session) {
    if (cookieToken) clearPatientSessionCookie(res);
    res.status(404).json({ error: 'This screening link or session is invalid or has expired.' });
    return null;
  }
  return session;
}

async function patientSessionPayload(s) {
  const active = await hasActiveConsent(s.screening_id, SCREENING_CONSENT_PURPOSE, SCREENING_CONSENT_VERSION);
  const view = publicSession(s);
  if (!active) {
    view.patient = {
      patient_name: s.patient?.patient_name || '',
      clinic_name: s.patient?.clinic_name || '',
      queue_token: s.patient?.queue_token || null,
      waiting_ahead: s.patient?.waiting_ahead ?? null,
      ui_language: s.patient?.ui_language || 'en',
    };
    view.conversation = [];
    if (s.status !== 'consent_withdrawn') view.status = 'in_progress';
    return { ...view, output: null };
  }
  return { ...view, output: publicOutput(await getOutput(s.screening_id)) };
}

function applyLanguage(s, body) {
  const lang = normalizeUiLang(body?.language || s.patient?.ui_language || 'en');
  if (!s.patient) s.patient = {};
  const changed = s.patient.ui_language !== lang;
  s.patient.ui_language = lang;
  return { lang, changed };
}

app.get('/', servePatientPage);
app.get('/s/:token', servePatientPage);
app.get('/app.js', serveStaticAsset('app.js', 'application/javascript'));
app.get('/screening.css', serveStaticAsset('screening.css', 'text/css'));

app.post('/api/patient/redeem', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const redeemed = await redeemPatientToken(token);
    if (redeemed) {
      setPatientSessionCookie(req, res, redeemed.token, redeemed.expiresAt);
      return res.json(await patientSessionPayload(redeemed.session));
    }
    const cookieToken = readCookie(req, PATIENT_SESSION_COOKIE);
    // A supplied URL token that failed redemption must never fall back to an
    // unrelated session cookie. The browser removes a successfully redeemed
    // token from the URL, so retries with a bearer token fail closed.
    if (!token) {
      const existing = cookieToken ? await getSessionByPatientToken(cookieToken) : null;
      if (existing) return res.json(await patientSessionPayload(existing));
    }
    return res.status(404).json({ error: 'This screening link is invalid, expired or already used.' });
  } catch (e) {
    console.error('patient link redemption failed');
    return res.status(500).json({ error: 'Unable to open this screening link.' });
  }
});

async function handlePatientSessionGet(req, res, linkToken) {
  try {
    const s = await getPatientContext(req, res, linkToken);
    if (!s) return;
    res.json(await patientSessionPayload(s));
  } catch (e) {
    console.error('patient session error');
    res.status(500).json({ error: 'Unable to load screening.' });
  }
}

app.get('/api/patient/s/:token', (req, res) => handlePatientSessionGet(req, res, req.params.token));
app.get('/api/patient/session', (req, res) => handlePatientSessionGet(req, res));

async function handlePatientSessionStart(req, res, linkToken) {
  try {
    const s = await getPatientContext(req, res, linkToken);
    if (!s) return;
    if (s.status === 'consent_withdrawn') {
      return res.status(409).json({ error: 'Consent was withdrawn. Start a new screening if you wish to participate again.' });
    }

    // Consent is a server-enforced precondition, not a client-side UI hint.
    // Existing sessions may change language only after a valid consent record exists.
    const consentVersion = SCREENING_CONSENT_VERSION;
    const consentPurpose = SCREENING_CONSENT_PURPOSE;
    const alreadyConsented = await hasActiveConsent(s.screening_id, consentPurpose, consentVersion);
    const isNewConsent = req.body?.patient_consent === true &&
      req.body?.consent_version === consentVersion;
    if (!alreadyConsented && !isNewConsent) {
      return res.status(403).json({
        error: 'Patient consent is required before screening can begin.',
        consent_required: true,
        consent_version: consentVersion,
      });
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

    const last = s.conversation[s.conversation.length - 1];
    if (last && last.role === 'assistant') {
      if (changed && last.qid) {
        const q = specialtyQuestionDef(s, last.qid) || { id: last.qid, text: last.message, options: [] };
        const localized = await localizeForPatient(q, lang);
        last.message = localized.text;
        last.localized_options = localized.options;
        await saveSession(s);
      }
      return res.json(questionPayload(s, last));
    }

    const result = await continueBrowserSession(s);
    res.json(result);
  } catch (e) {
    console.error('patient start error');
    res.status(502).json({ error: 'Clinical assistant is temporarily unavailable. Please try again.' });
  }
}

app.post('/api/patient/s/:token/start', (req, res) => handlePatientSessionStart(req, res, req.params.token));
app.post('/api/patient/session/start', (req, res) => handlePatientSessionStart(req, res));

async function handlePatientSessionWithdraw(req, res, linkToken) {
  try {
    const s = await getPatientContext(req, res, linkToken);
    if (!s) return;
    const purpose = SCREENING_CONSENT_PURPOSE;
    const noticeVersion = SCREENING_CONSENT_VERSION;
    const active = await hasActiveConsent(s.screening_id, purpose, noticeVersion);
    if (!active) {
      await revokePatientToken(s.screening_id);
      clearPatientSessionCookie(res);
      return res.json({ ok: true, consent_withdrawn: true, already_withdrawn: true });
    }

    const consentEvent = await appendConsentEvent({
      screening_id: s.screening_id,
      event_type: 'withdrawn',
      purpose,
      notice_version: noticeVersion,
      language: normalizeUiLang(s.patient?.ui_language || 'en'),
      method: 'patient_withdrawal_request',
      channel: 'patient_screening_app',
      actor_type: 'patient',
      evidence: { endpoint: 'patient_consent_withdrawal' },
    });
    const withdrawnAt = consentEvent.occurred_at;
    s.status = 'consent_withdrawn';
    s.updated_at = withdrawnAt;
    await saveSession(s);
    await revokePatientToken(s.screening_id);
    clearPatientSessionCookie(res);
    return res.json({ ok: true, consent_withdrawn: true, withdrawn_at: withdrawnAt });
  } catch (e) {
    console.error('patient consent withdrawal failed');
    return res.status(500).json({ error: 'Unable to record consent withdrawal.' });
  }
}

app.post('/api/patient/s/:token/withdraw', (req, res) => handlePatientSessionWithdraw(req, res, req.params.token));
app.post('/api/patient/session/withdraw', (req, res) => handlePatientSessionWithdraw(req, res));

async function handlePatientSessionMessage(req, res, linkToken) {
  try {
    const s = await getPatientContext(req, res, linkToken);
    if (!s) return;
    if (s.status !== 'in_progress') {
      return res.status(409).json({ error: 'This screening is no longer accepting answers.' });
    }
    if (!(await hasActiveConsent(s.screening_id, SCREENING_CONSENT_PURPOSE, SCREENING_CONSENT_VERSION))) {
      return res.status(403).json({ error: 'Patient consent is required before answers can be processed.', consent_required: true });
    }

    applyLanguage(s, req.body);

    const last = s.conversation[s.conversation.length - 1];
    if (!last || last.role !== 'assistant') {
      return res.status(409).json({ error: 'There is no question waiting for an answer.' });
    }

    if (last.qid) {
      const q = specialtyQuestionDef(s, last.qid);
      if (!q) return res.status(409).json({ error: 'Question not found. Please reload the page.' });
      const r = resolveAnswer(q, req.body);
      if (!r.ok) return res.status(400).json({ error: r.error });
      s.conversation.push({
        role: 'patient', message: r.message, at: new Date().toISOString(),
        qid: last.qid, kind: last.kind, question: last.message, selected: r.selected
      });
    } else {
      const text = typeof req.body?.message === 'string'
        ? req.body.message.trim()
        : (typeof req.body?.text === 'string' ? req.body.text.trim() : '');
      if (!text || text.length > 4000) return res.status(400).json({ error: 'Please enter an answer.' });
      s.conversation.push({ role: 'patient', message: text, at: new Date().toISOString() });
    }
    await saveSession(s);
    res.json(await continueBrowserSession(s));
  } catch (e) {
    console.error('patient message error');
    res.status(502).json({ error: 'Clinical assistant is temporarily unavailable. Please try again.' });
  }
}

app.post('/api/patient/s/:token/message', (req, res) => handlePatientSessionMessage(req, res, req.params.token));
app.post('/api/patient/session/message', (req, res) => handlePatientSessionMessage(req, res));

async function handlePatientSessionSummaryGet(req, res, linkToken) {
  try {
    const s = await getPatientContext(req, res, linkToken);
    if (!s) return;
    if (!(await hasActiveConsent(s.screening_id, SCREENING_CONSENT_PURPOSE, SCREENING_CONSENT_VERSION))) {
      return res.status(403).json({ error: 'Active patient consent is required to access this summary.' });
    }
    if (s.status === 'consent_withdrawn') return res.status(403).json({ error: 'Consent has been withdrawn.' });
    const output = await getOutput(s.screening_id);
    if (!output) return res.status(409).json({ error: 'The screening is still in progress.' });
    res.json({ output: publicOutput(output) });
  } catch (e) {
    console.error('patient summary error');
    res.status(500).json({ error: 'Unable to load screening summary.' });
  }
}

app.get('/api/patient/s/:token/summary', (req, res) => handlePatientSessionSummaryGet(req, res, req.params.token));
app.get('/api/patient/session/summary', (req, res) => handlePatientSessionSummaryGet(req, res));

async function handlePatientSessionSummaryPut(req, res, linkToken) {
  try {
    const s = await getPatientContext(req, res, linkToken);
    if (!s) return;
    if (!(await hasActiveConsent(s.screening_id, SCREENING_CONSENT_PURPOSE, SCREENING_CONSENT_VERSION))) {
      return res.status(403).json({ error: 'Active patient consent is required to edit this summary.' });
    }
    if (s.status !== 'awaiting_review') return res.status(409).json({ error: 'The summary cannot be edited now.' });
    const current = await getOutput(s.screening_id);
    if (!current) return res.status(404).json({ error: 'Summary not found.' });
    const updated = editableOutput(req.body, current);
    await saveOutput(s.screening_id, updated);
    res.json({ output: updated });
  } catch (e) {
    console.error('patient summary update error');
    res.status(500).json({ error: 'Unable to save your changes.' });
  }
}

app.put('/api/patient/s/:token/summary', (req, res) => handlePatientSessionSummaryPut(req, res, req.params.token));
app.put('/api/patient/session/summary', (req, res) => handlePatientSessionSummaryPut(req, res));

async function handlePatientSessionSubmit(req, res, linkToken) {
  try {
    const s = await getPatientContext(req, res, linkToken);
    if (!s) return;
    if (!(await hasActiveConsent(s.screening_id, SCREENING_CONSENT_PURPOSE, SCREENING_CONSENT_VERSION))) {
      return res.status(403).json({ error: 'A valid patient consent record is required before submission.' });
    }
    if (s.status !== 'awaiting_review') return res.status(409).json({ error: 'The screening is not ready to submit.' });
    const output = await getOutput(s.screening_id);
    if (!output) return res.status(404).json({ error: 'Summary not found.' });

    const finalOutput = {
      ...output,
      patient_approved: true,
      submitted_at: new Date().toISOString(),
      screening_status: output.screening_status || 'completed'
    };
    await saveOutput(s.screening_id, finalOutput);
    s.status = 'submitted';
    s.submitted_at = finalOutput.submitted_at;
    await saveSession(s);

    // The URL token has been consumed by redemption. Do not send that dead
    // bearer URL again; a separate resumable-link credential needs its own field.
    const whatsapp = { ok: false, error: 'A fresh patient link is not issued from a redeemed session.' };

    res.json({
      status: 'submitted',
      screening_id: s.screening_id,
      queue: { token: s.patient.queue_token || null, waiting_ahead: s.patient.waiting_ahead ?? null },
      output: finalOutput,
      whatsapp_sent: Boolean(whatsapp.ok),
      whatsapp_error: whatsapp.ok ? null : whatsapp.error
    });
  } catch (e) {
    console.error('patient submit error');
    res.status(500).json({ error: 'Unable to submit the screening.' });
  }
}

app.post('/api/patient/s/:token/submit', (req, res) => handlePatientSessionSubmit(req, res, req.params.token));
app.post('/api/patient/session/submit', (req, res) => handlePatientSessionSubmit(req, res));

app.post('/api/screenings', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
    if (!validInput(req.body)) {
      return res.status(400).json({ error: 'Invalid input JSON. Required: patient_name, age, gender, complaint, phone.' });
    }
    const clinic_id = String(req.body.clinic_id || '').trim().slice(0, 120) || null;
    if (!clinic_id || requestClinicId(req) !== clinic_id) {
      return res.status(403).json({ error: 'Authenticated clinic scope is required and must match the screening clinic.' });
    }
    const qt = String(req.body.queue_token || '').trim().slice(0, 20);
    const wa = Number.isInteger(req.body.waiting_ahead) && req.body.waiting_ahead >= 0 && req.body.waiting_ahead < 1000 ? req.body.waiting_ahead : null;
    const specialty = normalizeSpecialty(req.body.specialty);
    const s = await createSession({ ...req.body, specialty, clinic_id, queue_token: qt || null, waiting_ahead: wa });
    res.status(201).json({
      screening_id: s.screening_id,
      status: s.status,
      patient_url: patientUrl(req, s.patient_token),
      clinic_id: s.patient.clinic_id || null,
      queue_status_url: queueStatusUrl()
    });
  } catch (e) {
    console.error('screening creation error');
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/screenings/:id', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
    const s = await getSession(req.params.id);
    if (!s) return res.status(404).json({ error: 'Screening not found.' });
    if (!serviceClinicMatches(req, s)) return res.status(404).json({ error: 'Screening not found.' });
    if (!(await hasActiveConsent(s.screening_id, SCREENING_CONSENT_PURPOSE, SCREENING_CONSENT_VERSION))) {
      return res.status(403).json({ error: 'Active patient consent is required to access screening data.' });
    }
    res.json(publicSession(s));
  } catch (e) {
    console.error('screening get error');
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/screenings/:id/revoke-token', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
    const s = await getSession(req.params.id);
    if (!s || !serviceClinicMatches(req, s)) {
      return res.status(404).json({ error: 'Screening not found.' });
    }
    const revoked = await revokePatientToken(req.params.id);
    if (!revoked) return res.status(404).json({ error: 'Screening not found.' });
    res.json({ ok: true, token_revoked: true });
  } catch (e) {
    console.error('patient token revocation failed');
    res.status(500).json({ error: 'Unable to revoke patient screening link.' });
  }
});

// Clinic-authenticated rights-request intake. No patient identifiers or clinical details
// are copied into the erasure case register.
app.post('/api/screenings/:id/erasure-requests', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
    const session = await getSession(req.params.id);
    if (!session || !serviceClinicMatches(req, session)) {
      return res.status(404).json({ error: 'Screening not found.' });
    }
    const reasonCode = String(req.body?.reason_code || 'patient_erasure_request').trim();
    if (!/^[a-z0-9_ -]{3,80}$/i.test(reasonCode)) {
      return res.status(400).json({ error: 'A valid reason code is required.' });
    }
    const created = await createErasureCase({
      screeningId: session.screening_id,
      clinicId: requestClinicId(req),
      reasonCode
    });
    // Stop further patient access while the clinic reviews the request.
    await revokePatientToken(session.screening_id);
    return res.status(201).json(created);
  } catch (e) {
    console.error('erasure request intake failed');
    return res.status(500).json({ error: 'Unable to register the erasure request.' });
  }
});

// A clinic must make and record an explicit decision. Approval requires a
// retention-basis statement for any evidence kept after clinical payload deletion.
app.post('/api/erasure-requests/:requestId/decision', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
    const clinicId = requestClinicId(req);
    const item = await getErasureCase(req.params.requestId);
    if (!item || item.clinic_id !== clinicId || item.status !== 'received') {
      return res.status(404).json({ error: 'Erasure request not found.' });
    }
    const decision = String(req.body?.decision || '').trim().toLowerCase();
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be approve or reject.' });
    }
    const retentionBasis = String(req.body?.retention_basis || '').trim();
    if (decision === 'approve' && retentionBasis.length < 12) {
      return res.status(400).json({ error: 'A documented retention basis is required before erasure can be approved.' });
    }
    const session = await getSession(item.screening_id);
    if (!session || String(session.patient?.clinic_id || '') !== clinicId) {
      return res.status(409).json({ error: 'The screening payload is no longer available for this request.' });
    }
    const updated = await finalizeErasureCase({
      requestId: item,
      clinicId,
      decision,
      retentionBasis: decision === 'approve' ? retentionBasis : null,
      outcomeCode: decision === 'approve' ? 'clinical_payload_deleted' : 'clinic_declined_erasure'
    });
    if (!updated) return res.status(409).json({ error: 'The erasure request has already been processed.' });
    return res.json({
      request_id: item.request_id,
      status: decision === 'approve' ? 'fulfilled' : 'rejected',
      payload_deleted: decision === 'approve',
      consent_evidence_retained: decision === 'approve'
    });
  } catch (e) {
    console.error('erasure decision failed');
    return res.status(500).json({ error: 'Unable to complete the erasure decision. Verify that the consent-evidence migration is applied.' });
  }
});

app.get('/api/screenings/:id/output', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
    const s = await getSession(req.params.id);
    if (!s) return res.status(404).json({ error: 'Screening not found.' });
    if (!serviceClinicMatches(req, s)) return res.status(404).json({ error: 'Screening not found.' });
    if (!(await hasActiveConsent(s.screening_id, SCREENING_CONSENT_PURPOSE, SCREENING_CONSENT_VERSION))) {
      return res.status(403).json({ error: 'Active patient consent is required to access screening output.' });
    }
    const output = await getOutput(req.params.id);
    if (!output) {
      return res.json({
        screening_id: s.screening_id,
        status: s.status,
        screening_status: s.status,
        in_progress: s.status === 'in_progress',
        output: null
      });
    }
    res.json({ ...output, status: s.status });
  } catch (e) {
    console.error('screening output error');
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ai-clinical-screening',
    architecture: 'browser-screening',
    link_delivery: 'consumer_application',
    inbound_whatsapp_conversation: false
  });
});

// Only start a real TCP listener outside Cloudflare Workers.
if (!globalThis.Cloudflare && !process.env.CF_PAGES) {
  app.listen(port, () => {
    console.log(`AI Clinical Screening listening on :${port}`);
  });
}

export default app;
