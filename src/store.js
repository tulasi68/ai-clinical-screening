import crypto from 'node:crypto';

/**
 * Cloudflare D1 is the only production persistence backend.
 * The binding is installed by src/index.js for each Worker request.
 */
function db() {
  const binding = globalThis.__SCREENING_D1;
  if (!binding || typeof binding.prepare !== 'function') {
    throw new Error('Cloudflare D1 binding DB is unavailable; screening data operations are disabled.');
  }
  return binding;
}

const id = () => `SCR-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
export function createPatientToken() { return crypto.randomBytes(32).toString('base64url'); }
export function hashPatientToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
export function normalizePhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10) d = '91' + d;
  if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1);
  return d;
}

function normalizeSpecialty(value) {
  const s = String(value || '').toLowerCase().trim().replace(/\s+/g, '_').slice(0, 40);
  return s || 'ent';
}
const SUPPORTED_UI_LANGS = new Set(['en','kn','hi','ta','te','ml','bn','or','as','mr','ur','bho','mai','ne','mni','brx']);
function normalizeUiLang(value) {
  const s = String(value || 'en').toLowerCase().trim();
  if (SUPPORTED_UI_LANGS.has(s)) return s;
  for (const c of SUPPORTED_UI_LANGS) {
    if (s === c || s.startsWith(c + '-') || s.startsWith(c + '_')) return c;
  }
  return 'en';
}

function sessionRow(s) {
  return {
    screening_id: s.screening_id, status: s.status, created_at: s.created_at,
    updated_at: s.updated_at, completed_at: s.completed_at || null,
    submitted_at: s.submitted_at || null,
    patient_json: JSON.stringify(s.patient || {}),
    conversation_json: JSON.stringify(s.conversation || []),
    question_count: Number(s.question_count || 0),
    last_inbound_message_id: s.last_inbound_message_id || null,
    patient_token_hash: s.patient_token_hash || null,
    patient_token_expires_at: s.patient_token_expires_at || null
  };
}
function fromRow(row) {
  if (!row) return null;
  let patient = {};
  let conversation = [];
  try { patient = JSON.parse(row.patient_json || '{}'); } catch { throw new Error('Stored patient record is invalid JSON.'); }
  try { conversation = JSON.parse(row.conversation_json || '[]'); } catch { throw new Error('Stored conversation record is invalid JSON.'); }
  return {
    screening_id: row.screening_id, status: row.status, created_at: row.created_at,
    updated_at: row.updated_at, completed_at: row.completed_at || null,
    submitted_at: row.submitted_at || null, patient, conversation,
    question_count: Number(row.question_count || 0),
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
  const ui_language = normalizeUiLang(input.ui_language || input.language || input.preferred_language || 'en');
  const is_follow_up = Boolean(input.is_follow_up || input.isFollowUp);
  const prior_summary = input.prior_summary || input.priorSummary || null;
  const prior_prescription = input.prior_prescription || input.priorPrescription || null;
  const prior_complaint = input.prior_complaint || input.priorComplaint || null;
  const prior_screening_id = input.prior_screening_id || input.priorScreeningId || null;
  const days_since = input.days_since_last_visit != null ? Number(input.days_since_last_visit) :
    (input.daysSinceLastVisit != null ? Number(input.daysSinceLastVisit) : null);
  const session = {
    screening_id, status: 'in_progress', created_at: now, updated_at: now,
    completed_at: null, submitted_at: null,
    patient: {
      patient_name: input.patient_name, age: input.age, gender: input.gender,
      complaint: input.complaint, phone: normalizePhone(input.phone),
      clinic_id: input.clinic_id || null, clinic_name: String(input.clinic_name || '').slice(0, 160), queue_token: input.queue_token || null,
      waiting_ahead: input.waiting_ahead ?? null, specialty: normalizeSpecialty(input.specialty),
      ui_language, is_follow_up,
      prior_screening_id: prior_screening_id ? String(prior_screening_id).slice(0, 120) : null,
      prior_summary: prior_summary ? String(prior_summary).slice(0, 4000) : null,
      prior_prescription: prior_prescription ? String(prior_prescription).slice(0, 4000) : null,
      prior_complaint: prior_complaint ? String(prior_complaint).slice(0, 2000) : null,
      days_since_last_visit: days_since != null && !Number.isNaN(days_since) ? days_since : null
    },
    conversation: [], question_count: 0, last_inbound_message_id: null,
    patient_token_hash: hashPatientToken(token), patient_token_expires_at: expires
  };
  const r = sessionRow(session);
  await db().prepare(`INSERT INTO screening_sessions
    (screening_id,status,created_at,updated_at,completed_at,submitted_at,patient_json,conversation_json,question_count,last_inbound_message_id,patient_token_hash,patient_token_expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(r.screening_id,r.status,r.created_at,r.updated_at,r.completed_at,r.submitted_at,r.patient_json,r.conversation_json,r.question_count,r.last_inbound_message_id,r.patient_token_hash,r.patient_token_expires_at).run();
  return { ...session, patient_token: token };
}

export async function getSession(screeningId) {
  const row = await db().prepare('SELECT * FROM screening_sessions WHERE screening_id = ? LIMIT 1').bind(String(screeningId)).first();
  return fromRow(row);
}
export async function saveSession(s) {
  s.updated_at = new Date().toISOString();
  const r = sessionRow(s);
  await db().prepare(`UPDATE screening_sessions SET status=?,updated_at=?,completed_at=?,submitted_at=?,patient_json=?,conversation_json=?,question_count=?,last_inbound_message_id=?,patient_token_hash=?,patient_token_expires_at=? WHERE screening_id=?`)
    .bind(r.status,r.updated_at,r.completed_at,r.submitted_at,r.patient_json,r.conversation_json,r.question_count,r.last_inbound_message_id,r.patient_token_hash,r.patient_token_expires_at,r.screening_id).run();
  return s;
}

export async function appendConsentEvent(event) {
  const row = {
    id: crypto.randomUUID(),
    screening_id: String(event?.screening_id || '').slice(0, 120),
    event_type: event?.event_type,
    purpose: String(event?.purpose || '').slice(0, 160),
    notice_version: String(event?.notice_version || '').slice(0, 80),
    // The ledger timestamp is server-owned; ignore caller-supplied time.
    occurred_at: new Date().toISOString(),
    language: String(event?.language || 'en').slice(0, 12),
    method: String(event?.method || 'affirmative_checkbox').slice(0, 80),
    channel: String(event?.channel || 'patient_screening_app').slice(0, 80),
    actor_type: String(event?.actor_type || 'patient').slice(0, 40),
    evidence: event?.evidence && typeof event.evidence === 'object' ? event.evidence : {}
  };
  if (!row.screening_id || !['granted','withdrawn'].includes(row.event_type) || !row.purpose || !row.notice_version) {
    throw new Error('A complete consent event is required.');
  }
  await db().prepare(`INSERT INTO screening_consent_events
    (id,screening_id,event_type,purpose,notice_version,occurred_at,language,method,channel,actor_type,evidence_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(row.id,row.screening_id,row.event_type,row.purpose,row.notice_version,row.occurred_at,row.language,row.method,row.channel,row.actor_type,JSON.stringify(row.evidence)).run();
  return row;
}

export async function getConsentEvents(screeningId, purpose) {
  const result = await db().prepare(`SELECT event_type,purpose,notice_version,occurred_at,language,method,channel,actor_type
    FROM screening_consent_events WHERE screening_id=? AND purpose=? ORDER BY rowid ASC`)
    .bind(String(screeningId),String(purpose)).all();
  return Array.isArray(result?.results) ? result.results : [];
}
export async function hasActiveConsent(screeningId, purpose, noticeVersion) {
  const events = await getConsentEvents(screeningId, purpose);
  const latest = events[events.length - 1];
  return Boolean(latest && latest.event_type === 'granted' && (!noticeVersion || latest.notice_version === noticeVersion));
}

export async function revokePatientToken(screeningId) {
  // Update credential columns only; do not overwrite the full mutable session
  // document and race with a concurrent answer or consent event.
  const now = new Date().toISOString();
  const result = await db().prepare(`UPDATE screening_sessions
    SET patient_token_hash=NULL,patient_token_expires_at=?,updated_at=?
    WHERE screening_id=?`)
    .bind(now,now,String(screeningId)).run();
  return Number(result?.meta?.changes || 0) > 0;
}

/**
 * Atomically exchange a single-use URL bearer token for a short-lived session
 * credential. The conditional UPDATE is the replay guard. Session content,
 * status, conversation and consent history are preserved for in-progress users.
 */
export async function redeemPatientToken(token) {
  const candidate = String(token || '').trim();
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(candidate)) return null;
  const now = new Date().toISOString();
  const configuredTtl = Number(process.env.PATIENT_SESSION_TTL_HOURS || 12);
  const ttlHours = Number.isFinite(configuredTtl) ? Math.min(Math.max(configuredTtl, 1), 24) : 12;
  const expiresAt = new Date(Date.now() + ttlHours * 3600000).toISOString();
  const sessionToken = createPatientToken();
  const row = await db().prepare(`UPDATE screening_sessions
    SET patient_token_hash=?,patient_token_expires_at=?,updated_at=?
    WHERE patient_token_hash=? AND patient_token_expires_at > ?
    RETURNING *`)
    .bind(hashPatientToken(sessionToken),expiresAt,now,hashPatientToken(candidate),now).first();
  if (!row) return null;
  return { session: fromRow(row), token: sessionToken, expiresAt };
}
export async function getSessionByPatientToken(token) {
  if (!token) return null;
  const hash = hashPatientToken(token);
  const row = await db().prepare(`SELECT * FROM screening_sessions
    WHERE patient_token_hash=? AND patient_token_expires_at > ? LIMIT 1`)
    .bind(hash,new Date().toISOString()).first();
  return fromRow(row);
}
export async function saveOutput(screeningId, obj) {
  const now = new Date().toISOString();
  await db().prepare(`INSERT INTO screening_outputs(screening_id,output_json,created_at,updated_at)
    VALUES(?,?,?,?) ON CONFLICT(screening_id) DO UPDATE SET output_json=excluded.output_json,updated_at=excluded.updated_at`)
    .bind(String(screeningId),JSON.stringify(obj),now,now).run();
}
export async function getOutput(screeningId) {
  const row = await db().prepare('SELECT output_json FROM screening_outputs WHERE screening_id=? LIMIT 1').bind(String(screeningId)).first();
  if (!row) return null;
  try { return JSON.parse(row.output_json); } catch { throw new Error('Stored screening output is invalid JSON.'); }
}
export async function findActiveByPhone(phone) {
  const target = normalizePhone(phone);
  if (!target) return null;
  const result = await db().prepare(`SELECT * FROM screening_sessions
    WHERE status='in_progress' ORDER BY created_at DESC LIMIT 50`).all();
  const last10 = target.slice(-10);
  for (const row of result?.results || []) {
    const session = fromRow(row);
    const stored = normalizePhone(session.patient?.phone);
    if (stored && (stored === target || stored.endsWith(last10))) return session;
  }
  return null;
}


/**
 * Minimal erasure case register. It intentionally stores no patient name,
 * phone number, complaint, conversation or screening output.
 */
export async function createErasureCase({ screeningId, clinicId, reasonCode = 'patient_erasure_request' }) {
  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db().prepare(`INSERT INTO screening_erasure_cases
    (request_id,screening_id,clinic_id,status,reason_code,requested_at,updated_at)
    VALUES(?,?,?,'received',?,?,?)`)
    .bind(requestId,String(screeningId),String(clinicId),String(reasonCode).slice(0,80),now,now).run();
  return { request_id: requestId, screening_id: String(screeningId), status: 'received', requested_at: now };
}

export async function getErasureCase(requestId) {
  return db().prepare(`SELECT request_id,screening_id,clinic_id,status,reason_code,
    requested_at,updated_at,completed_at,outcome_code,retention_basis
    FROM screening_erasure_cases WHERE request_id=? LIMIT 1`)
    .bind(String(requestId)).first();
}

/**
 * Fulfil/reject a case. D1 batch keeps payload deletion and case outcome atomic.
 * The consent ledger is intentionally outside the session cascade after migration 0002.
 */
export async function finalizeErasureCase({ requestId, clinicId, decision, retentionBasis = null, outcomeCode }) {
  const now = new Date().toISOString();
  const status = decision === 'approve' ? 'fulfilled' : 'rejected';
  const statements = [];
  if (decision === 'approve') {
    statements.push(db().prepare(`DELETE FROM screening_sessions
      WHERE screening_id=? AND json_extract(patient_json, '$.clinic_id')=?`)
      .bind(String(requestId.screening_id),String(clinicId)));
  }
  statements.push(db().prepare(`UPDATE screening_erasure_cases
    SET status=?,updated_at=?,completed_at=?,outcome_code=?,retention_basis=?
    WHERE request_id=? AND clinic_id=? AND status='received'`)
    .bind(status,now,now,String(outcomeCode || (decision === 'approve' ? 'payload_erased' : 'erasure_not_approved')).slice(0,80),
      retentionBasis ? String(retentionBasis).slice(0,500) : null,String(requestId.request_id),String(clinicId)));
  const results = await db().batch(statements);
  const finalResult = results[results.length - 1];
  return Number(finalResult?.meta?.changes || 0) > 0;
}
