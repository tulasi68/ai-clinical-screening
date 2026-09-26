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

  // URL button templates expect only the dynamic suffix (token after /s/)
  let buttonParam = patientUrl;
  try {
    const u = new URL(patientUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    const sIdx = parts.indexOf('s');
    if (sIdx >= 0 && parts[sIdx + 1]) buttonParam = decodeURIComponent(parts[sIdx + 1]);
  } catch { /* keep full url */ }

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
          parameters: [{ type: 'text', text: buttonParam }]
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
      specialty: s.patient.specialty || null
    },
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

async function continueBrowserSession(s) {
  if (s.question_count >= maxQuestions()) {
    return { type: 'review', output: publicOutput(await finishForReview(s, 'question_limit')) };
  }

  const step = await nextStep(s);

  if (step.status === 'QUESTION') {
    s.conversation.push({
      role: 'assistant', message: step.message, at: new Date().toISOString()
    });
    s.question_count++;
    await saveSession(s);
    return { type: 'question', message: step.message, question_count: s.question_count };
  }

  return {
    type: 'review',
    output: publicOutput(await finishForReview(s, step.status === 'URGENT' ? 'urgent' : 'completed'))
  };
}

function editableOutput(input, current) {
  const allowed = [
    'presenting_complaint', 'symptoms', 'associated_symptoms', 'medical_history',
    'medications', 'allergies', 'patient_concerns', 'summary'
  ];
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
  const expected = String(
    process.env.SCREENING_API_KEY || process.env.CLINICAL_SCREENING_API_KEY || ""
  ).trim();
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
    res.json({
      ...publicSession(s),
      output: publicOutput(output)
    });
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
      return res.json({ type: 'question', message: last.message, question_count: s.question_count });
    }

    const result = await continueBrowserSession(s);
    res.json(result);
  } catch (e) {
    console.error('patient start error', e);
    res.status(502).json({
      error: 'Clinical assistant is temporarily unavailable. Please try again in a moment.',
      detail: String(e?.message || e).slice(0, 200)
    });
  }
});

app.post('/api/patient/s/:token/message', async (req, res) => {
  try {
    const text = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!text || text.length > 4000) return res.status(400).json({ error: 'Please enter an answer.' });

    const s = await getPatientContext(req.params.token, res);
    if (!s) return;
    if (s.status !== 'in_progress') {
      return res.status(409).json({ error: 'This screening is no longer accepting answers.' });
    }

    s.conversation.push({ role: 'patient', message: text, at: new Date().toISOString() });
    await saveSession(s);
    const result = await continueBrowserSession(s);
    res.json(result);
  } catch (e) {
    console.error('patient message error', e);
    // Soft recovery: keep patient answer saved; ask a simple follow-up so chat does not die
    try {
      const s = await getSessionByPatientToken(req.params.token);
      if (s && s.status === 'in_progress') {
        const fallback = 'Thank you. How long have you had this problem (in days)?';
        s.conversation.push({ role: 'assistant', message: fallback, at: new Date().toISOString() });
        s.question_count = (s.question_count || 0) + 1;
        await saveSession(s);
        return res.json({ type: 'question', message: fallback, question_count: s.question_count, recovered: true });
      }
    } catch (inner) {
      console.error('patient message recovery failed', inner);
    }
    res.status(502).json({
      error: 'Clinical assistant is temporarily unavailable. Please try again in a moment.',
      detail: String(e?.message || e).slice(0, 200)
    });
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

    const complaintLink = patientUrl(req, req.params.token);
    const whatsapp = complaintLink ? await sendComplaintLink(s.patient.phone, complaintLink) : { ok: false, error: 'Patient link unavailable' };

    res.json({
      status: 'submitted',
      screening_id: s.screening_id,
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
    const s = await createSession(req.body);
    res.status(201).json({
      screening_id: s.screening_id,
      status: s.status,
      patient_url: patientUrl(req, s.patient_token),
      specialty: s.patient?.specialty || null
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
  link_delivery: 'consumer_application',
  inbound_whatsapp_conversation: false
}));

export default app;
if (process.env.VERCEL !== '1') app.listen(port, () => console.log(`AI Clinical Screening listening on :${port}`));
