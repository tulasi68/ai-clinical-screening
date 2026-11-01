# Phase 6 — Screening verification and release gates

**Status:** Test plan; tests must be executed and evidence attached before a release/compliance assertion.

## 1. Consent and patient access
- Missing, declined, stale-version and withdrawn consent block start/message/summary/submit.
- Wrong/expired/revoked/replayed patient URL token fails closed.
- Successful redemption is single-use; cookie is HttpOnly, Secure in production and SameSite.
- Invalid URL token never falls back to another patient's cookie session.
- Concurrent withdrawal and answer/message cannot allow processing after withdrawal.
- Patient cannot read another session by changing IDs/cookies.

## 2. Tenant and service API
- Missing/wrong clinic key denied.
- Key for clinic A cannot access clinic B.
- Malformed tenant-key map fails closed.
- Shared-key migration mode only works when explicitly configured.
- Session/output reads, create, revoke, export and deletion all enforce clinic scope.
- MediLoop receives only its clinic's screening output.

## 3. Rights, deletion and audit
- Export/correction/deletion commands require authenticated clinic instruction.
- Deletion is idempotent and revokes credentials immediately.
- Session and output payloads are deleted; approved consent evidence follows its own retention schedule.
- Backup restore reapplies deletion tombstones.
- No patient content or secrets appear in logs.
- Audit trail is append-only and access-controlled.

## 4. Runtime verification
Run unit tests, `npm run check`, production build and HTTP integration tests against a staging Worker/D1 database. Verify cookie behavior, CSP, no-store headers, rate limits, D1 concurrency and backup/restore. Capture commit SHA, command, environment, result, CI run and reviewer.

## 5. Release gates

A. Source/data-flow review complete.  
B. Automated security and unit tests pass.  
C. Staging HTTP/D1 tests pass with synthetic data.  
D. Clinic approves notice, purposes, retention, rights contact and processor list.  
E. Operations approves backup, migration, secrets, monitoring and rollback.

No production migration, secret/configuration change or deployment is authorised by this document. Do not claim DPDP/IT Act compliance until all applicable requirements and operational evidence have been reviewed.
