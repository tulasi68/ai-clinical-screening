import crypto from 'node:crypto';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function requireConfigured() {
  if (!configured()) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }
}

async function request(path, options = {}) {
  requireConfigured();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || data?.error || text || `Supabase HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

const id = () =>
  `SCR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

function sessionRow(s) {
  return {
    screening_id: s.screening_id,
    status: s.status,
    created_at: s.created_at,
    updated_at: s.updated_at,
    completed_at: s.completed_at || null,
    patient: s.patient,
    conversation: s.conversation || [],
    question_count: s.question_count || 0,
    last_inbound_message_id: s.last_inbound_message_id || null
  };
}

function fromRow(row) {
  if (!row) return null;
  return {
    screening_id: row.screening_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at || null,
    patient: row.patient,
    conversation: row.conversation || [],
    question_count: row.question_count || 0,
    last_inbound_message_id: row.last_inbound_message_id || null
  };
}

export async function createSession(input) {
  const screening_id = id();
  const now = new Date().toISOString();
  const session = {
    screening_id,
    status: 'in_progress',
    created_at: now,
    updated_at: now,
    completed_at: null,
    patient: {
      patient_name: input.patient_name,
      age: input.age,
      gender: input.gender,
      complaint: input.complaint,
      phone: input.phone
    },
    conversation: [],
    question_count: 0,
    last_inbound_message_id: null
  };

  await request('screening_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(sessionRow(session))
  });

  return session;
}

export async function getSession(screeningId) {
  const rows = await request(
    `screening_sessions?screening_id=eq.${encodeURIComponent(screeningId)}&select=*&limit=1`
  );
  return fromRow(rows?.[0]);
}

export async function saveSession(s) {
  s.updated_at = new Date().toISOString();

  await request(
    `screening_sessions?screening_id=eq.${encodeURIComponent(s.screening_id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(sessionRow(s))
    }
  );

  return s;
}

export async function findActiveByPhone(phone) {
  const target = String(phone || '').replace(/\D/g, '');
  if (!target) return null;

  const filter = encodeURIComponent(`eq.${target}`);
  const rows = await request(
    `screening_sessions?status=eq.in_progress&patient->>phone=${filter}&order=created_at.desc&limit=1&select=*`
  );

  return fromRow(rows?.[0]);
}

export async function saveOutput(screeningId, obj) {
  await request('screening_outputs', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      screening_id: screeningId,
      output: obj
    })
  });
}

export async function getOutput(screeningId) {
  const rows = await request(
    `screening_outputs?screening_id=eq.${encodeURIComponent(screeningId)}&select=*&limit=1`
  );
  return rows?.[0]?.output || null;
}
