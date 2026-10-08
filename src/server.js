import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import {
  createSession, getSession, saveSession, saveOutput, getOutput,
  getSessionByPatientToken
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
// Resolve from the project root in Vercel and Cloudflare's virtual filesystem.
const __dirname = path.resolve('src');
app.use(express.static(path.join(__dirname, '../public')));
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

async function sendComplaintLink(phone, patientUrl) {
  const phoneNumberId = String(process.env.WA_PHONE_NUMBER_ID || '').trim();
  const accessToken = String(process.env.WA_ACCESS_TOKEN || '').trim();
  const apiVersion = String(process.env.WA_API_VERSION || 'v21.0').trim();
  const templateName = String(process.env.WA_COMPLAINT_TEMPLATE_NAME || 'mediloop_add_complaints').trim();
  const languageCode = String(process.env.WA_COMPLAINT_TEMPLATE_LANGUAGE || 'en').trim();

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
    console.error('WhatsApp complaint link send failed', { status: response.status, data });
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

  // Free-form AI question (no fixed def)
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
  // Prefer labels from localizeQuestion; keep option ids intact
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
  const expected = String(process.env.SCREENING_API_KEY || "").trim();
  if (!expected) return process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1";
  const suppliedKey = String(req.headers["x-api-key"] || "").trim();
  const authorization = String(req.headers.authorization || "").trim();
  const bearerKey = authorization.replace(/^Bearer\s+/i, "").trim();
  return suppliedKey === expected || bearerKey === expected;
}

function patientUrl(req, token) {
  const base = String(process.env.PATIENT_APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
  return base + '/s/' + encodeURIComponent(token);
}

function queueStatusUrl() {
  const configured = String(process.env.MEDILOOP_QUEUE_STATUS_URL || '').trim();
  return configured || 'https://mediloop-ai.vercel.app/api/public/queue-status';
}

async function getPatientContext(token, res) {
  const s = await getSessionByPatientToken(token);
  if (!s) {
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

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/s/:token', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.get('/api/patient/s/:token', async (req, res) => {
  try {
    const s = await getPatientContext(req.params.token, res);
    if (!s) return;
    const output = await getOutput(s.screening_id);
    res.json({ ...publicSession(s), output: publicOutput(output) });
  } catch (e) {
    console.error('patient session error', e);
    res.status(500).json({ error: 'Unable to load screening.' });
  }
});

app.post('/api/patient/s/:token/start', async (req, res) => {
  try {
    const s = await getPatientContext(req.params.token, res);
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
    console.error('patient start error', e);
    res.status(502).json({ error: 'Clinical assistant is temporarily unavailable. Please try again.' });
  }
});

app.post('/api/patient/s/:token/message', async (req, res) => {
  try {
    const s = await getPatientContext(req.params.token, res);
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

app.get('/api/patient/s/:token/summary', async (req, res) => {
  try {
    const s = await getPatientContext(req.params.token, res);
    if (!s) return;
    const output = await getOutput(s.screening_id);
    if (!output) return res.status(409).json({ error: 'The screening is still in progress.' });
    res.json({ output: publicOutput(output) });
  } catch (e) {
    console.error('patient summary error', e);
    res.status(500).json({ error: 'Unable to load screening summary.' });
  }
});

app.put('/api/patient/s/:token/summary', async (req, res) => {
  try {
    const s = await getPatientContext(req.params.token, res);
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

app.post('/api/patient/s/:token/submit', async (req, res) => {
  try {
    const s = await getPatientContext(req.params.token, res);
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

    const complaintLink = String(req.params.token ? `${String(process.env.BASE_URL || '').replace(/\/$/, '')}/s/${encodeURIComponent(req.params.token)}` : '').trim();
    const whatsapp = complaintLink ? await sendComplaintLink(s.patient.phone, complaintLink) : { ok: false, error: 'Patient link unavailable' };

    res.json({
      status: 'submitted',
      screening_id: s.screening_id,
      queue: { token: s.patient.queue_token || null, waiting_ahead: s.patient.waiting_ahead ?? null },
      output: finalOutput,
      whatsapp_sent: Boolean(whatsapp.ok),
      whatsapp_error: whatsapp.ok ? null : whatsapp.error
    });
  } catch (e) {
    console.error('patient submit error', e);
    res.status(500).json({ error: 'Unable to submit the screening.' });
  }
});

app.post('/api/screenings', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
    if (!validInput(req.body)) {
      return res.status(400).json({ error: 'Invalid input JSON. Required: patient_name, age, gender, complaint, phone.' });
    }
    const clinic_id = String(req.body.clinic_id || '').trim().slice(0, 120) || null;
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
    console.error('screening creation error', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/screenings/:id/output', async (req, res) => {
  if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
  const o = await getOutput(req.params.id);
  if (!o) return res.status(404).json({ screening_id: req.params.id, status: 'in_progress' });
  res.json(o);
});

app.get('/api/screenings/:id', async (req, res) => {
  if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
  const s = await getSession(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json({ ...publicSession(s), patient_token_hash: undefined });
});

app.get('/health', (req, res) => res.json({
  ok: true,
  service: 'ai-clinical-screening',
  architecture: 'browser-screening',
  link_delivery: "consumer_application",
  inbound_whatsapp_conversation: false
}));

export default app;
if (process.env.VERCEL !== '1') app.listen(port, () => console.log(`AI Clinical Screening listening on :${port}`));
