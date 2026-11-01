# Phase 4 — Screening retention and deletion

**Status:** Proposed schedule; periods require clinic/legal approval.

## 1. Data classes

| Data | Store | Trigger | Period |
|---|---|---|---|
| Session identity and contact | D1 `screening_sessions.patient_json` | Session completion / clinical record incorporation | [Clinic-approved] |
| Conversation | D1 `conversation_json` | Session completion | [Clinic-approved] |
| Derived output | D1 `screening_outputs` | Clinical review / incorporation | [Clinic-approved] |
| Consent event | D1 `screening_consent_events` | Grant/withdrawal | [Approved evidence period] |
| Token hash and expiry | D1 session columns | Redemption/revocation/expiry | Minimum operational period |
| Worker/platform logs | Cloudflare | Log creation | Applicable legal/security schedule |
| Backups | Cloudflare/provider | Backup creation | Provider retention schedule and deletion replay |

No fixed clinical retention period is asserted here. Confirm applicable facility, state, professional and record-category requirements.

## 2. Deletion requirements

Implement an authenticated clinic-scoped deletion command with request ID, idempotency, explicit target session IDs and audit evidence. It must:
- Revoke patient credentials immediately.
- Delete eligible session and output payloads.
- Preserve only separately approved consent evidence, if required.
- Notify MediLoop of success/failure and exceptions.
- Ensure backup expiry and reapply deletion tombstones after restore.
- Avoid retaining clinical payload in logs or deletion evidence.
- Respect a documented legal hold and return a clear exception instead of silently claiming deletion.

## 3. Consent migration

Migration `0002_preserve_consent_evidence.sql` is present but not applied. It removes the cascading FK so consent evidence survives payload deletion. Before applying: backup/export D1, review evidence JSON, test migration on a copy, verify row counts/indexes/triggers and document retention authority. Do not apply to production without a separate approved change window.

## 4. Acceptance criteria

Synthetic data tests cover active session, completed session, output, consent history, revoked token, legal hold, repeat request, failed downstream propagation and backup restore.
