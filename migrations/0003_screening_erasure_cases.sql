-- Track patient erasure requests without retaining patient identifiers or clinical payloads.
-- Apply only after 0002_preserve_consent_evidence.sql has been reviewed and applied.
CREATE TABLE IF NOT EXISTS screening_erasure_cases (
  request_id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'fulfilled', 'rejected')),
  reason_code TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  outcome_code TEXT,
  retention_basis TEXT
);

CREATE INDEX IF NOT EXISTS screening_erasure_cases_clinic_status_idx
  ON screening_erasure_cases(clinic_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS screening_erasure_cases_screening_idx
  ON screening_erasure_cases(screening_id, requested_at DESC);
