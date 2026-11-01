-- Cloudflare D1 schema for AI Clinical Screening.
-- Patient and clinical payloads remain in the screening service's own database.

CREATE TABLE IF NOT EXISTS screening_sessions (
  screening_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  submitted_at TEXT,
  patient_json TEXT NOT NULL,
  conversation_json TEXT NOT NULL DEFAULT '[]',
  question_count INTEGER NOT NULL DEFAULT 0,
  last_inbound_message_id TEXT,
  patient_token_hash TEXT UNIQUE,
  patient_token_expires_at TEXT
);

CREATE INDEX IF NOT EXISTS screening_sessions_status_created_idx
  ON screening_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS screening_sessions_token_idx
  ON screening_sessions(patient_token_hash, patient_token_expires_at);

CREATE TABLE IF NOT EXISTS screening_outputs (
  screening_id TEXT PRIMARY KEY REFERENCES screening_sessions(screening_id) ON DELETE CASCADE,
  output_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS screening_consent_events (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL REFERENCES screening_sessions(screening_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('granted', 'withdrawn')),
  purpose TEXT NOT NULL,
  notice_version TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  method TEXT NOT NULL,
  channel TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'patient',
  evidence_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS screening_consent_events_lookup_idx
  ON screening_consent_events(screening_id, purpose, occurred_at, id);

CREATE TRIGGER IF NOT EXISTS screening_consent_events_no_update
BEFORE UPDATE ON screening_consent_events
BEGIN
  SELECT RAISE(ABORT, 'screening consent evidence is append-only');
END;

CREATE TRIGGER IF NOT EXISTS screening_consent_events_no_delete
BEFORE DELETE ON screening_consent_events
BEGIN
  SELECT RAISE(ABORT, 'screening consent evidence is append-only');
END;
