import crypto from 'node:crypto';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configured() { return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY); }
function requireConfigured() {
  if (!configured()) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
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
    const suffix = response.status === 401 ? 'Supabase authentication failed. Check that SUPABASE_SERVICE_ROLE_KEY belongs to this project and is current.' : '';
    throw new Error(`Supabase HTTP ${response.status}: ${message}${suffix ? ` — ${suffix}` : ''}`);
  }
  return data;
}

const id = () => `SCR-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
export function createPatientToken() { return crypto.randomBytes(32).toString('base64url'); }
export function hashPatientToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
export function normalizePhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  while (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && !d.startsWith('91')) d = d.replace(/^0+/, '');
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10) d = '91' + d;
  return d;
}

function normalizeSpecialty(value) {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, '_').slice(0, 40);
}

function sessionRow(s) {
  return {
    screening_id: s.screening_id, status: s.status, created_at: s.created_at,
    updated_at: s.updated_at, completed_at: s.completed_at || null,
    submitted_at: s.submitted_at || null, patient: s.patient,
    conversation: s.conversation || [], question_count: s.question_count || 0,
    last_inbound_message_id: s.last_inbound_message_id || null,
    patient_token_hash: s.patient_token_hash || null,
    patient_token_expires_at: s.patient_token_expires_at || null
  };
}
function fromRow(row) {
  if (!row) return null;
  return {
    screening_id: row.screening_id, status: row.status, created_at: row.created_at,
    updated_at: row.updated_at, completed_at: row.completed_at || null,
    submitted_at: row.submitted_at || null, patient: row.patient,
    conversation: row.conversation || [], question_count: row.question_count || 0,
    last_inbound_message_id: row.last_inbound_message_id || null,
    patient_token_hash: row.patient_token_hash || null,
    patient_token_expires_at: row.patient_token_expires_at || null
  };
}

export async function createSession(input) {
  const screening_id = id();
  const now = new Date().toISOString();
  const token = createPatientToken();
  const expires = new Date(Date.now() + Number(process.env.PATIENT_TOKEN_TTL_HOURS || 72) * 3600000).toISOString();
  const session = {
    screening_id, status: 'in_progress', created_at: now, updated_at: now,
    completed_at: null, submitted_at: null,
    patient: {
      patient_name: input.patient_name,
      age: input.age,
      gender: input.gender,
      complaint: input.complaint,
      phone: normalizePhone(input.phone),
      specialty: normalizeSpecialty(input.specialty || input.clinic_specialty || 'ent')
    },
    conversation: [], question_count: 0, last_inbound_message_id: null,
    patient_token_hash: hashPatientToken(token), patient_token_expires_at: expires
  };
  await request('screening_sessions', {
    method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(sessionRow(session))
  });
  return { ...session, patient_token: token };
}

export async function getSession(screeningId) {
  const rows = await request(`screening_sessions?screening_id=eq.${encodeURIComponent(screeningId)}&select=*&limit=1`);
  return fromRow(rows?.[0]);
}
export async function saveSession(s) {
  s.updated_at = new Date().toISOString();
  await request(`screening_sessions?screening_id=eq.${encodeURIComponent(s.screening_id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(sessionRow(s))
  });
  return s;
}
export async function getSessionByPatientToken(token) {
  if (!token) return null;
  const hash = hashPatientToken(token);
  const rows = await request(
    `screening_sessions?patient_token_hash=eq.${encodeURIComponent(hash)}&select=*&limit=1`
  );
  const s = fromRow(rows?.[0]);
  if (!s) return null;
  if (!s.patient_token_expires_at || new Date(s.patient_token_expires_at).getTime() < Date.now()) return null;
  return s;
}
export async function saveOutput(screeningId, obj) {
  await request('screening_outputs', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ screening_id: screeningId, output: obj })
  });
}
export async function getOutput(screeningId) {
  const rows = await request(`screening_outputs?screening_id=eq.${encodeURIComponent(screeningId)}&select=*&limit=1`);
  return rows?.[0]?.output || null;
}

export async function findActiveByPhone(phone) {
  const target = normalizePhone(phone);
  if (!target) return null;
  const rows = await request('screening_sessions?status=eq.in_progress&order=created_at.desc&limit=50&select=*');
  const last10 = target.slice(-10);
  for (const row of rows || []) {
    const stored = normalizePhone(row.patient?.phone);
    if (stored && (stored === target || stored.endsWith(last10))) return fromRow(row);
  }
  return null;
}
