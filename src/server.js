import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSession, getSession, saveSession, saveOutput, getOutput,
  getSessionByPatientToken
} from './store.js';
import { nextStep, consolidate } from './ai.js';

const app = express();
app.use(express.json({ limit: '256kb' }));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../public')));
const port = Number(process.env.PORT || 3000);
const maxQuestions = () => Number(process.env.MAX_QUESTIONS || 12);

function normalizePhone(phone) {
  let raw = String(phone || '').replace(/\D/g, '');
  while (raw.startsWith('00')) raw = raw.slice(2);
  if (raw.startsWith('0') && !raw.startsWith('91')) raw = raw.replace(/^0+/, '');
  if (raw.length === 10) return '91' + raw;
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
  let buttonParam = patientUrl;
  try {
    const u = new URL(patientUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    const sIdx = parts.indexOf('s');
    if (sIdx >= 0 && parts[sIdx + 1]) buttonParam = decodeURIComponent(parts[sIdx + 1]);
  } catch { /* keep full url */ }
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'template',
      template: {
        name: templateName, language: { code: languageCode },
        components: [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: buttonParam }] }]
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
  return { ...output, patient: output.patient ? { ...output.patient, phone: undefined } : output.patient };
}

function publicSession(s) {
  return {
    screening_id: s.screening_id, status: s.status,
    patient: { patient_name: s.patient.patient_name, age: s.patient.age, gender: s.patient.gender, complaint: s.patient.complaint, specialty: s.patient.specialty || null },
    question_count: s.question_count,
    conversation: (s.conversation || []).map(x => ({ role: x.role, message: x.message, at: x.at })),
    patient_token_expires_at: s.patient_token_expires_at
  };
}

async function finishForReview(s, reason) {
  const out = await consolidate(s);
  out.screening_id = s.screening_id;
  out.screening_status = reason === 'urgent' ? 'urgent' : 'completed';
  out.patient_approved = false;
  out.submitted_at = null;
  await saveOutput(s.screening_id, out);
  s.status = 'awaiting_review';
  s.completed_at = new Date().toISOString();
  await saveSession(s);
  return out;
}

function focusQuestionText(question) {
  const raw = String(question || "").trim();
  if (!raw) return "";
  const parts = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const withQ = parts.filter((s) => s.includes("?"));
  if (withQ.length) return withQ[0].toLowerCase();
  return (parts[parts.length - 1] || raw).toLowerCase();
}

function questionChoices(question) {
  const full = String(question || "").toLowerCase();
  const q = focusQuestionText(question);
  const make = (items, multi = false) => {
    const options = items.map(([key, label, value]) => ({ key, label, value }));
    const keys = new Set(options.map((o) => o.key));
    if (!keys.has("unsure")) options.push({ key: "unsure", label: "I'm not sure", value: "patient is not sure" });
    if (!keys.has("other") && !keys.has("none")) options.push({ key: "other", label: "Other / type my own", value: "__FREE_TEXT__" });
    return { mode: multi ? "multi" : "single", options };
  };

  if (/describe.*(discharge|fluid|pus)|discharge.*(watery|thick|yellow|green|bloody|colour|color)|what.*(look|colour|color).*discharge/.test(q)) {
    return make([
      ["watery", "Watery / clear", "watery clear discharge"],
      ["thick", "Thick / sticky", "thick discharge"],
      ["yellow", "Yellow", "yellow discharge"],
      ["green", "Green", "green discharge"],
      ["bloody", "Bloody / blood-stained", "bloody discharge"],
      ["none", "No discharge", "no discharge"],
    ]);
  }

  if (/muffled|underwater|hearing trouble|can't hear|cannot hear|hearing change|what.*hearing/.test(q) && !/fever|discharge from/.test(q)) {
    return make([
      ["muffled", "Feels muffled / underwater", "hearing feels muffled"],
      ["reduced", "Can't hear clearly", "reduced hearing"],
      ["left_only", "Only on one side", "hearing trouble on one side"],
      ["none", "Hearing is fine", "no hearing trouble"],
    ]);
  }

  if (/ear drops|painkiller|home remed|already taken|tried any|any medicine|used drops|taking anything|did they help/.test(q)) {
    return make([
      ["none", "Nothing tried yet", "not tried any medicine"],
      ["paracetamol", "Painkiller (paracetamol etc.)", "took painkiller"],
      ["drops", "Ear drops", "used ear drops"],
      ["antibiotic", "Antibiotic", "took antibiotic"],
      ["home", "Home remedy only", "tried home remedy"],
      ["helped", "Tried something and it helped", "medicine helped"],
      ["no_help", "Tried something but no help", "medicine did not help"],
    ]);
  }

  if (/allerg/.test(q)) {
    return make([
      ["none", "No known drug allergy", "no known drug allergy"],
      ["yes", "Yes, I have a drug allergy", "drug allergy reported"],
    ]);
  }

  if (/how many days|how long|getting worse|staying the same|better or worse|since when|same .*days|a bit longer/.test(q)) {
    return make([
      ["1_2d", "1–2 days", "for 1 to 2 days"],
      ["3_7d", "3–7 days", "for 3 to 7 days"],
      ["1_2w", "1–2 weeks", "for 1 to 2 weeks"],
      ["longer", "More than 2 weeks", "for more than 2 weeks"],
      ["worse", "Getting worse", "getting worse"],
      ["same", "About the same", "staying the same"],
      ["better", "Getting better", "getting better"],
    ]);
  }

  if (/how severe|mild.*moderate.*severe|how bad|severity|scale of/.test(q)) {
    return make([
      ["mild", "Mild", "mild"],
      ["moderate", "Moderate", "moderate"],
      ["severe", "Severe", "severe"],
    ]);
  }

  if (/left.*right.*both|left ear.*right ear|which (ear|side)|one side|both (ears|sides)|left or right|on the left|is it in the left/.test(q)) {
    return make([
      ["left", "Left only", "left"],
      ["right", "Right only", "right"],
      ["bilateral", "Both sides", "bilateral"],
    ]);
  }

  if (/throat pain.*swallow|swallowing|raw.*sore|sore feeling|when you swallow/.test(q) && /throat/.test(q + full)) {
    return make([
      ["swallow", "Pain mainly when swallowing", "throat pain mainly when swallowing"],
      ["sore", "Constant sore / raw feeling", "constant sore throat"],
      ["both", "Both when swallowing and constant", "throat pain on swallowing and constant soreness"],
      ["none", "No throat pain", "no throat pain"],
    ]);
  }

  if (/fever|dizziness|vertigo|swollen gland|change in your voice|associated/.test(q)) {
    return make([
      ["fever", "Fever", "fever"],
      ["dizzy", "Dizziness / spinning", "dizziness"],
      ["glands", "Swollen neck glands", "swollen neck glands"],
      ["voice", "Voice change", "voice change"],
      ["cold", "Recent cold / sinus issue", "recent cold"],
      ["none", "None of these", "none reported"],
    ], true);
  }

  if (/what.?s been happening.*ear|pain.*blockage.*discharge.*hearing|which of these.*ear|feeling in that ear|what exactly.*(feeling|going on).*ear|what.*feeling.*ear/.test(q)) {
    return make([
      ["pain", "Pain", "ear pain"],
      ["blockage", "Blockage", "ear blockage"],
      ["discharge", "Discharge", "ear discharge"],
      ["hearing_change", "Hearing trouble", "hearing trouble"],
      ["ringing", "Ringing / tinnitus", "tinnitus"],
    ], true);
  }

  if (
    /ear.*nose.*throat|nose.*throat|problem with your ear|problem with.*ear|which.*(ear|nose|throat)|mainly the ear|combination of these|ear, nose/.test(q)
    && !/discharge|describe|medicine|days|fever|feeling in that/.test(q)
  ) {
    return make([
      ["ear", "Ear", "ear"],
      ["nose", "Nose", "nose"],
      ["throat", "Throat", "throat"],
      ["combo", "More than one (combination)", "combination of ear nose throat"],
    ]);
  }

  if (/pain actually in the ear|more in the throat|mainly in the ear or|ear or the throat|throat or the ear/.test(q) && !/discharge|describe|medicine|days|fever/.test(q)) {
    return make([
      ["ear", "Mainly in the ear", "pain mainly in the ear"],
      ["throat", "Mainly in the throat when swallowing", "pain mainly in the throat when swallowing"],
      ["both", "Both ear and throat", "pain in both ear and throat"],
    ]);
  }

  if (/what.?s been happening.*nose/.test(q)) {
    return make([
      ["blockage", "Nasal blockage", "nasal blockage"],
      ["runny", "Runny nose", "runny nose"],
      ["discharge", "Nasal discharge", "nasal discharge"],
      ["sneezing", "Sneezing", "sneezing"],
    ], true);
  }

  if (/ongoing illness|diabetes|blood pressure|regular medicines/.test(q)) {
    return make([
      ["bp", "High blood pressure", "high blood pressure"],
      ["diabetes", "Diabetes", "diabetes"],
      ["asthma", "Asthma", "asthma"],
      ["other", "Another ongoing illness", "other ongoing illness"],
      ["none", "No ongoing illness", "none reported"],
    ], true);
  }

  if (
    /\?/.test(q)
    && /\b(do you|have you|is there|are you|did you)\b/.test(q)
    && (q.match(/\?/g) || []).length <= 1
    && !/ear|nose|throat|feeling|pain|discharge|hearing|medicine|days|allergy|fever|left|right/.test(q)
  ) {
    return make([
      ["yes", "Yes", "yes"],
      ["no", "No", "no"],
    ]);
  }

  return make([
    ["partial", "Somewhat / partly", "somewhat"],
  ]);
}

function questionResponse(message) {
  const choices = questionChoices(message);
  return choices
    ? { options: choices.options, selection_mode: choices.mode }
    : { options: [], selection_mode: "single" };
}

function simplifyDoctorMessage(message) {
  const raw = String(message || "").trim();
  if (!raw) return raw;
  const sentences = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const questions = sentences.filter((s) => s.includes("?"));
  if (questions.length <= 1) return raw;
  const ack = sentences.find((s) => !s.includes("?"));
  const primary = questions[0];
  if (ack && ack.length < 120) return `${ack} ${primary}`.trim();
  return primary;
}

async function continueBrowserSession(s) {
  if (s.question_count >= maxQuestions()) {
    return { type: 'review', output: publicOutput(await finishForReview(s, 'question_limit')) };
  }
  const step = await nextStep(s);
  if (step.status === 'QUESTION') {
    step.message = simplifyDoctorMessage(step.message);
    s.conversation.push({ role: 'assistant', message: step.message, at: new Date().toISOString() });
    s.question_count++;
    await saveSession(s);
    return { type: 'question', message: step.message, question_count: s.question_count, ...questionResponse(step.message) };
  }
  return { type: 'review', output: publicOutput(await finishForReview(s, step.status === 'URGENT' ? 'urgent' : 'completed')) };
}

function editableOutput(input, current) {
  const allowed = ['presenting_complaint', 'symptoms', 'associated_symptoms', 'medical_history', 'medications', 'allergies', 'patient_concerns', 'summary'];
  const out = { ...current };
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(input || {}, key)) out[key] = input[key];
  }
  out.screening_id = current.screening_id;
  out.screening_status = current.screening_status;
  out.patient_approved = false;
  out.submitted_at = null;
  return out;
}

function validServerApiKey(req) {
  const expected = String(process.env.SCREENING_API_KEY || process.env.CLINICAL_SCREENING_API_KEY || "").trim();
  if (!expected) return process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1";
  const suppliedKey = String(req.headers["x-api-key"] || "").trim();
  const authorization = String(req.headers.authorization || "").trim();
  const bearerKey = authorization.replace(/^Bearer\s+/i, "").trim();
  return suppliedKey === expected || bearerKey === expected;
}

function patientUrl(req, token) {
  const base = String(process.env.PATIENT_APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return `${base}/s/${encodeURIComponent(token)}`;
}

async function getPatientContext(token, res) {
  const s = await getSessionByPatientToken(token);
  if (!s) {
    res.status(404).json({ error: 'This screening link is invalid or has expired.' });
    return null;
  }
  return s;
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
    if (s.status === 'awaiting_review' || s.status === 'submitted') {
      return res.json({ type: 'review', output: publicOutput(await getOutput(s.screening_id)) });
    }
    if (s.status !== 'in_progress') return res.status(409).json({ error: 'Screening is not available.' });
    if (s.conversation.some(x => x.role === 'assistant')) {
      const last = [...s.conversation].reverse().find(x => x.role === 'assistant');
      return res.json({ type: 'question', message: last.message, question_count: s.question_count, ...questionResponse(last.message) });
    }
    const result = await continueBrowserSession(s);
    res.json(result);
  } catch (e) {
    console.error('patient start error', e);
    res.status(502).json({ error: 'Clinical assistant is temporarily unavailable. Please try again in a moment.', detail: String(e?.message || e).slice(0, 200) });
  }
});

app.post('/api/patient/s/:token/message', async (req, res) => {
  try {
    const text = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const selectedOption = req.body?.selected_option && typeof req.body.selected_option === 'object' ? req.body.selected_option : null;
    if (!text || text.length > 4000) return res.status(400).json({ error: 'Please enter an answer.' });
    const s = await getPatientContext(req.params.token, res);
    if (!s) return;
    if (s.status !== 'in_progress') return res.status(409).json({ error: 'This screening is no longer accepting answers.' });
    s.conversation.push({
      role: 'patient', message: text,
      question: String(req.body?.question || [...s.conversation].reverse().find((x) => x.role === 'assistant')?.message || '').slice(0, 1000),
      selected_option: selectedOption ? { key: String(selectedOption.key || '').slice(0, 80), label: String(selectedOption.label || text).slice(0, 200), value: String(selectedOption.value || text).slice(0, 300) } : null,
      at: new Date().toISOString()
    });
    await saveSession(s);
    const result = await continueBrowserSession(s);
    res.json(result);
  } catch (e) {
    console.error('patient message error', e);
    try {
      const s = await getSessionByPatientToken(req.params.token);
      if (s && s.status === 'in_progress') {
        const fallback = 'Thank you. How long have you had this problem (in days)?';
        s.conversation.push({ role: 'assistant', message: fallback, at: new Date().toISOString() });
        s.question_count = (s.question_count || 0) + 1;
        await saveSession(s);
        return res.json({ type: 'question', message: fallback, question_count: s.question_count, recovered: true, ...questionResponse(fallback) });
      }
    } catch (inner) { console.error('patient message recovery failed', inner); }
    res.status(502).json({ error: 'Clinical assistant is temporarily unavailable. Please try again in a moment.', detail: String(e?.message || e).slice(0, 200) });
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
    const finalOutput = { ...output, patient_approved: true, submitted_at: new Date().toISOString(), screening_status: output.screening_status || 'completed' };
    await saveOutput(s.screening_id, finalOutput);
    s.status = 'submitted';
    s.submitted_at = finalOutput.submitted_at;
    await saveSession(s);
    const complaintLink = patientUrl(req, req.params.token);
    const whatsapp = complaintLink ? await sendComplaintLink(s.patient.phone, complaintLink) : { ok: false, error: 'Patient link unavailable' };
    res.json({ status: 'submitted', screening_id: s.screening_id, output: finalOutput, whatsapp_sent: Boolean(whatsapp.ok), whatsapp_error: whatsapp.ok ? null : whatsapp.error });
  } catch (e) {
    console.error('patient submit error', e);
    res.status(500).json({ error: 'Unable to submit the screening.' });
  }
});

app.post('/api/screenings', async (req, res) => {
  try {
    if (!validServerApiKey(req)) return res.status(401).json({ error: 'Unauthorized screening service request.' });
    if (!validInput(req.body)) return res.status(400).json({ error: 'Invalid input JSON. Required: patient_name, age, gender, complaint, phone.' });
    const s = await createSession(req.body);
    res.status(201).json({ screening_id: s.screening_id, status: s.status, patient_url: patientUrl(req, s.patient_token), specialty: s.patient?.specialty || null });
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
  link_delivery: 'consumer_application',
  inbound_whatsapp_conversation: false
}));

export default app;
if (process.env.VERCEL !== '1') app.listen(port, () => console.log(`AI Clinical Screening on :${port}`));
