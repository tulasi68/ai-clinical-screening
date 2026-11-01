-- Preserve append-only consent evidence when clinical screening payloads are deleted.
-- This migration copies every existing event, removes the cascading FK, and recreates
-- the append-only guards. Review and back up the D1 database before applying.
DROP TRIGGER IF EXISTS screening_consent_events_no_update;
DROP TRIGGER IF EXISTS screening_consent_events_no_delete;

CREATE TABLE screening_consent_events_new (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
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

INSERT INTO screening_consent_events_new
  (id,screening_id,event_type,purpose,notice_version,occurred_at,language,method,channel,actor_type,evidence_json)
SELECT id,screening_id,event_type,purpose,notice_version,occurred_at,language,method,channel,actor_type,evidence_json
FROM screening_consent_events;

DROP TABLE screening_consent_events;
ALTER TABLE screening_consent_events_new RENAME TO screening_consent_events;

CREATE INDEX screening_consent_events_lookup_idx
  ON screening_consent_events(screening_id, purpose, occurred_at, id);

CREATE TRIGGER screening_consent_events_no_update
BEFORE UPDATE ON screening_consent_events
BEGIN
  SELECT RAISE(ABORT, 'screening consent evidence is append-only');
END;

CREATE TRIGGER screening_consent_events_no_delete
BEFORE DELETE ON screening_consent_events
BEGIN
  SELECT RAISE(ABORT, 'screening consent evidence is append-only');
END;
