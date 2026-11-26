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

function normalizeSpecialty(value) {
  const s = String(value || '').toLowerCase().trim().replace(/\s+/g, '_').slice(0, 40);
  return s || 'ent';
}

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

function validErasureAdminKey(req) {
  const authorization = String(req.headers.authorization || '').trim();
  const bearerKey = authorization.replace(/^Bearer\s+/i, '').trim();
  const suppliedKey = String(req.headers['x-api-key'] || bearerKey).trim();
  return isValidServiceCredential({
    clinicId: requestClinicId(req),
    suppliedKey,
    tenantKeysJson: process.env.SCREENING_ERASURE_ADMIN_KEYS_JSON,
    sharedKey: '',
    allowSharedKey: false,
    managedRuntime: true,
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
  if (!cookieToken) {
    res.status(404).json({ error: 'This screening link is invalid or has expired.' });
    return null;
  }
  const s = await getSessionByPatientToken(cookieToken);
  if (!s) {
    clearPatientSessionCookie(res);
    res.status(404).json({ error: 'This screening link is invalid or has expired.' });
    return null;
  }
  return s;
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

// Exchange the single-use URL token for a short-lived, HttpOnly session cookie.
app.post('/api/patient/redeem', async (req, res) => {
  try {
    const candidate = String(req.body?.token || '').trim();
    const redeemed = await redeemPatientToken(candidate);
    if (!redeemed) {
      return res.status(404).json({ error: 'This screening link is invalid, expired or already used.' });
    }
    setPatientSessionCookie(req, res, redeemed.token, redeemed.expiresAt);
    const output = await getOutput(redeemed.session.screening_id);
    res.json({ ...publicSession(redeemed.session), output: publicOutput(output) });
  } catch (e) {
    console.error('patient token redemption error', e);
    res.status(500).json({ error: 'Unable to open this screening link.' });
  }
});

// Resume an already redeemed session using the HttpOnly cookie.
app.get('/api/patient/session', async (req, res) => {
  try {
    const s = await getPatientContext(req, res, null);
    if (!s) return;
    const output = await getOutput(s.screening_id);
    res.json({ ...publicSession(s), output: publicOutput(output) });
  } catch (e) {
    console.error('patient session error', e);
    res.status(500).json({ error: 'Unable to load screening.' });
  }
});

app.get('/api/patient/s/:token', async (req, res) => {
  try {
    const s = await getPatientContext(req, res, req.params.token);
    if (!s) return;
    const output = await getOutput(s.screening_id);
    res.json({ ...publicSession(s), output: publicOutput(output) });
  } catch (e) {
    console.error('patient session error', e);
    res.status(500).json({ error: 'Unable to load screening.' });
  }
});

app.post(['/api/patient/s/:token/start', '/api/patient/session/start'], async (req, res) => {
  try {
    const s = await getPatientContext(req, res, req.params.token);
    if (!s) return;

    const { changed, lang } = applyLanguage(s, req.body);
    if (changed) await saveSession(s);

    if (s.status === 'awaiting_review' || s.status === 'submitted') {
      return res.json({ type: 'review', output: publicOutput(await getOutput(s.screening_id)) });
    }
    if (s.status !== 'in_progress') return res.status(409).json({ error: 'Screening is not available.' });

    const last = s.conversation[s.conversation.length - 1];
    if (last && last.role === 'assistant') {
      if (changed && last.qid) {
        const q = specialtyQuestionDef(s, last.qid) || { id: last.qid, text: last.message, options: [] };
        const localized = localizeForPatient(q, lang);
        last.message = localized.text;
        last.localized_options = localized.options;
        await saveSession(s);
      }
      return res.json(questionPayload(s, last));
    }

    const result = await continueBrowserSession(s);
    res.json(result);
  } catch (e) {
    console.error('patient start error', e);
    res.status(502).json({ error: 'Clinical assistant is temporarily unavailable. Please try again.' });
  }
});

app.post(['/api/patient/s/:token/message', '/api/patient/session/message'], async (req, res) => {
  try {
    const s = await getPatientContext(req, res, req.params.token);
    if (!s) return;
    if (s.status !== 'in_progress') {
      return res.status(409).json({ error: 'This screening is no longer accepting answers.' });
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
    console.error('patient message error', e);
    res.status(502).json({ error: 'Clinical assistant is temporarily unavailable. Please try again.' });
  }
});

app.get(['/api/patient/s/:token/summary', '/api/patient/session/summary'], async (req, res) => {
  try {
    const s = await getPatientContext(req, res, req.params.token);
    if (!s) return;
    const output = await getOutput(s.screening_id);
    if (!output) return res.status(409).json({ error: 'The screening is still in progress.' });
    res.json({ output: publicOutput(output) });
  } catch (e) {
    console.error('patient summary error', e);
    res.status(500).json({ error: 'Unable to load screening summary.' });
  }
});

app.put(['/api/patient/s/:token/summary', '/api/patient/session/summary'], async (req, res) => {
  try {
    const s = await getPatientContext(req, res, req.params.token);
    if (!s) return;
    if (s.status !== 'awaiting_review') return res.status(409).json({ error: 'The summary cannot be edited now.' });
    const current = await getOutput(s.screening_id);
    if (!current) return res.status(404).json({ error: 'Summary not found.' });
    const updated = editableOutput(req.body, current);
    await saveOutput(s.screening_id, updated);
    res.json({ output: updated });
  } catch (e) {
    console.error('patient summary update error', e);
    res.status(500).json({ error: 'Unable to save your changes.' });
  }
});

app.post(['/api/patient/s/:token/submit', '/api/patient/session/submit'], async (req, res) => {
  try {
    const s = await getPatientContext(req, res, req.params.token);
    if (!s) return;
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

    // The patient's one-time URL token has already been exchanged and invalidated.
    // Do not send that consumed URL again; the browser session is cookie-authenticated.
    res.json({
      status: 'submitted',
      screening_id: s.screening_id,
      output: finalOutput,
      whatsapp_sent: false,
      whatsapp_error: null
    });
  } catch (e) {
    console.error('patient submit error', e);
    res.status(500).json({ error: 'Unable to submit the screening.' });
  }
});

// Patient-requested consent withdrawal: stop the session and invalidate its cookie credential.
app.post(['/api/patient/s/:token/withdraw', '/api/patient/session/withdraw'], async (req, res) => {
  try {
    const session = await getPatientContext(req, res, req.params.token || null);
    if (!session) return;
    if (session.status === 'submitted') {
      return res.status(409).json({ error: 'This screening has already been submitted. Please contact the clinic for assistance.' });
    }
    if (session.status !== 'consent_withdrawn') {
      await appendConsentEvent({
        screening_id: session.screening_id,
        event_type: 'withdrawn',
        purpose: SCREENING_CONSENT_PURPOSE,
        notice_version: SCREENING_CONSENT_VERSION,
        language: session.patient?.ui_language || 'en',
        method: 'patient_in_app_withdrawal',
        channel: 'patient_screening_app',
        actor_type: 'patient'
      });
    }
    session.status = 'consent_withdrawn';
    session.patient_token_hash = null;
    session.patient_token_expires_at = new Date().toISOString();
    await saveSession(session);
    clearPatientSessionCookie(res);
    res.json({ status: 'consent_withdrawn', screening_id: session.screening_id });
  } catch (e) {
    console.error('patient consent withdrawal error', e);
    res.status(500).json({ error: 'Unable to withdraw consent. Please contact the clinic.' });
  }
});

app.post('/api/screenings', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
    if (!validInput(req.body)) {
      return res.status(400).json({ error: 'Invalid input JSON. Required: patient_name, age, gender, complaint, phone.' });
    }
    const s = await createSession(req.body);
    res.status(201).json({
      screening_id: s.screening_id,
      status: s.status,
      patient_url: patientUrl(req, s.patient_token)
    });
  } catch (e) {
    console.error('screening creation error', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/screenings/:id/output', async (req, res) => {
  if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
  const o = await getOutput(req.params.id);
  if (!o) return res.status(404).json({ screening_id: req.params.id, status: 'in_progress' });
  if (!serviceClinicMatches(req, { patient: { clinic_id: o.patient?.clinic_id } }) && o.patient?.clinic_id) {
    return res.status(403).json({ error: 'Clinic scope mismatch.' });
  }
  res.json(o);
});

app.get('/api/screenings/:id', async (req, res) => {
  if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
  const s = await getSession(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (!serviceClinicMatches(req, s) && s.patient?.clinic_id) {
    return res.status(403).json({ error: 'Clinic scope mismatch.' });
  }
  res.json({ ...publicSession(s), patient_token_hash: undefined });
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
