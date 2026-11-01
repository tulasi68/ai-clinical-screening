# Phase 3 — Patient rights and grievance workflow

**Status:** Operational design; the service is not a standalone rights fulfilment authority.

## 1. Responsibility

The clinic/Data Fiduciary receives and decides patient requests. Screening must support the clinic's authenticated instruction to export, correct, restrict or erase screening data and must report completion or exceptions. MediLoop coordinates the clinic workflow. Contracts must define request routing and response SLAs.

## 2. Screening-specific processor actions

- Locate all sessions and outputs associated with the verified patient/clinic.
- Export only the requested subject's data through an authenticated, audited channel.
- Apply clinic-approved corrections without silently rewriting historical consent evidence.
- Stop processing after withdrawal or instruction.
- Delete eligible session and output payloads on authorised instruction.
- Report completion, affected identifiers, backup expiry and exceptions to MediLoop/clinic.
- Preserve only the minimal consent evidence authorised by the retention policy and lawful basis.

## 3. Workflow and evidence

Request receipt → identity/authority verification by clinic → clinic instruction → Screening case ID → locate records → action → downstream/backup status → response to clinic → closure. Every action must be tenant-scoped, authenticated, idempotent and audited. Do not expose a public unauthenticated endpoint for arbitrary patient data export/deletion.

## 4. Current gap

There is no complete patient-facing rights-request case-management feature in this service. Existing consent withdrawal is not equivalent to access/correction/erasure fulfilment. The service needs authenticated processor endpoints, request correlation IDs, idempotency, deletion/export tests and a clinic-facing completion response.
