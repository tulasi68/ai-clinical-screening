# Implementation backlog status — 6 Nov 2026

This records what was implemented in code versus what still needs ops/legal action.

| # | Item | Code status | Ops / legal |
|---|------|-------------|-------------|
| 1 | MediLoop consent ledger | See MediLoop repo | Dual-write / migration plan |
| 2 | Production verification | Not claimed | Run staging E2E, apply D1 migrations 0002/0003 |
| 3 | Resource-level patient API | See MediLoop | Wire UI to new routes |
| 4 | Audit immutability | Partial (append-only API) | Durable ledger still Redis-capped |
| 5 | Rate limiting | **Added** `src/rateLimit.js` (in-process) | Upgrade to CF Rate Limiting for multi-instance |
| 6 | Log redaction | **Added** `src/redact.js` | Audit platform/Logpush pipelines |
| 7 | Deletion propagation | Erasure cases exist; 0002/0003 pending apply | Clinic retention policy + MediLoop callback |
| 8 | Clinic-specific config | Templates only | Legal entity, contacts, retention periods |
| 9 | Children's data | **Added** `src/ageGate.js` + notice text | Wire UI + guardian verification process |
| 10 | CERT-In readiness | **Added** `docs/cert-in-incident-response.md` | Fill contacts; confirm 180-day logs |

**Do not treat this commit as production compliance certification.**
