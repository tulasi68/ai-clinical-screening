//src/server.js
import 'dotenv/config';
import express from 'express';
import { createSession, getSession, saveSession, findActiveByPhone, saveOutput, getOutput } from './store.js';
import { sendInitial, sendText, forwardWebhook, normalizePhone } from './whatsapp.js';
import { nextStep, consolidate } from './ai.js';

const app = express();
app.use(express.json({ limit: '256kb' }));
const port = Number(process.env.PORT || 3000);

function validInput(x) {
  return (
    x &&
    typeof x.patient_name === 'string' &&
    x.patient_name.trim() &&
    Number.isInteger(x.age) &&
    typeof x.gender === 'string' &&
    typeof x.complaint === 'string' &&
    x.complaint.trim() &&
    typeof x.phone === 'string'
  );
}

async function continueSession(s) {
  if (s.question_count >= Number(process.env.MAX_QUESTIONS || 12)) {
    return finish(s, 'question_limit');
  }

  const step = await nextStep(s);

  if (step.status === 'QUESTION') {
    s.conversation.push({
      role: 'assistant',
      message: step.message,
      at: new Date().toISOString()
    });
    s.question_count++;
    await saveSession(s);
    await sendText(s.patient.phone, step.message);
    console.log(
      `[screening ${s.screening_id}] sent question #${s.question_count}: ${String(step.message).slice(0, 80)}`
    );
    return;
  }

  s.conversation.push({
    role: 'assistant',
    message: step.message || 'Thank you. The information collection is complete.',
    at: new Date().toISOString()
  });
  await saveSession(s);
  await finish(s, step.status.toLowerCase());
}

async function finish(s, reason) {
  const out = await consolidate(s);
  out.screening_id = s.screening_id;
  out.screening_status = reason === 'urgent' ? 'urgent' : 'completed';
  await saveOutput(s.screening_id, out);
  s.status = out.screening_status;
  s.completed_at = new Date().toISOString();
  await saveSession(s);
  await sendText(
    s.patient.phone,
    reason === 'urgent'
      ? 'Thank you. Please seek urgent medical care now for the concern you described. This chat does not provide a diagnosis or treatment.'
      : 'Thank you. Your information has been collected and will be available to your healthcare professional.'
  );
  console.log(`[screening ${s.screening_id}] finished reason=${reason} status=${s.status}`);
}

app.get('/', (req, res) =>
  res.json({ service: 'ai-clinical-screening', status: 'ok', message: 'AI Clinical Screening API' })
);

app.get('/health', (req, res) =>
  res.json({
    ok: true,
    service: 'ai-clinical-screening',
    whatsapp: Boolean(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN)
  })
);

app.post('/api/screenings', async (req, res) => {
  try {
    if (!validInput(req.body)) {
      return res.status(400).json({
        error: 'Invalid input JSON. Required: patient_name, age, gender, complaint, phone.'
      });
    }
    const s = await createSession(req.body);
    await sendInitial(s.patient.phone, s.patient.patient_name, s.patient.complaint);
    await continueSession(s);
    res.status(202).json({ screening_id: s.screening_id, status: 'started' });
  } catch (e) {
    console.error('screening start error', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/screenings/:id/output', async (req, res) => {
  const o = await getOutput(req.params.id);
  if (!o) return res.status(404).json({ screening_id: req.params.id, status: 'in_progress' });
  res.json(o);
});

app.get('/api/screenings/:id', async (req, res) => {
  const s = await getSession(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json({ ...s, patient: { ...s.patient, phone: undefined } });
});

app.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WA_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post('/webhooks/whatsapp', async (req, res) => {
  try {
    const body = req.body;
    let handled = 0;

    for (const entry of body?.entry || []) {
      for (const change of entry?.changes || []) {
        const value = change?.value || {};

        for (const msg of value.messages || []) {
          const fromRaw = msg.from;
          const from = normalizePhone(fromRaw);
          const text =
            msg.text?.body ||
            msg.button?.text ||
            msg.interactive?.button_reply?.title ||
            '';

          console.log(
            `[webhook] inbound from=${fromRaw} normalized=${from} type=${msg.type} text=${String(text).slice(0, 60)}`
          );

          if (!text) {
            console.log(`[webhook] skip non-text message id=${msg.id}`);
            continue;
          }

          const s = await findActiveByPhone(from);
          if (!s) {
            console.log(`[webhook] no active session for phone=${from}; forwarding if configured`);
            await forwardWebhook(body);
            continue;
          }

          if (s.last_inbound_message_id === msg.id) {
            console.log(`[webhook] duplicate message id=${msg.id}; skip`);
            continue;
          }

          s.last_inbound_message_id = msg.id;
          s.conversation.push({
            role: 'patient',
            message: text,
            at: new Date().toISOString()
          });
          await saveSession(s);
          console.log(
            `[webhook] matched screening=${s.screening_id} q_count=${s.question_count}; continuing`
          );
          await continueSession(s);
          handled++;
        }
      }
    }

    // Acknowledge only after processing so the Vercel serverless invocation
    // cannot terminate before the Supabase/Sarvam/WhatsApp work completes.
    console.log(`[webhook] done handled=${handled}`);
    res.sendStatus(200);
  } catch (e) {
    console.error('webhook processing error', e.message, e.stack);
    res.sendStatus(500);
  }
});

export default app;

if (process.env.VERCEL !== '1') {
  app.listen(port, () => console.log(`AI Clinical Screening listening on :${port}`));
}
