# Screening patient erasure workflow (staged implementation)

This workflow is implemented on the `compliance/hardening-p0` branch. It is not enabled for production until the required D1 migrations and a separate clinic-admin credential have been configured and tested.

## Required migration order

1. Back up the target D1 database and verify the backup can be restored.
2. Review and apply `0002_preserve_consent_evidence.sql`. It removes the cascading foreign key from the consent ledger and reinstates append-only triggers.
3. Apply `0003_screening_erasure_cases.sql` to create the minimal request register.
4. Verify that deleting a test session removes its clinical payload/output while retaining its consent events and erasure case outcome.

Do not apply migration 0002 to production without a tested backup and staging rehearsal.

## Credentials

- Request intake uses the existing clinic-scoped `SCREENING_CLINIC_API_KEYS_JSON` integration credential.
- Approve/reject requires a separate clinic-scoped secret, `SCREENING_ERASURE_ADMIN_KEYS_JSON`, with the same JSON mapping shape as the service credential map (clinic ID to key).
- The admin credential has no shared-key fallback. If it is absent or does not match the request's `x-clinic-id`, the decision endpoint fails closed.
- Do not reuse the integration key as the erasure-admin key.

## API

All calls require `x-clinic-id`. Send the relevant key in `Authorization: Bearer ...` or `x-api-key`.

### Register a request

`POST /api/screenings/:screeningId/erasure-requests`

Optional JSON body:

```json
{ "reason_code": "patient_erasure_request" }
```

This verifies clinic ownership, creates a minimal case record, and revokes the patient's screening token to stop further patient access while the clinic reviews the request. It does not delete clinical data.

### Approve or reject

`POST /api/erasure-requests/:requestId/decision`

This endpoint requires the separate erasure-admin credential.

Approve:

```json
{
  "decision": "approve",
  "retention_basis_code": "consent_evidence_retention"
}
```

Reject:

```json
{ "decision": "reject" }
```

Approval deletes the screening session and its dependent output. Consent evidence remains in the independent append-only ledger. The case register retains only the screening reference, clinic reference, timestamps, reason/outcome codes and the retention-basis code. Rejection leaves the screening payload in place, but the patient link remains revoked and must be reissued through a separately authorized process if appropriate.

## Important limitations

- This is a clinic-authorized technical workflow, not a legal determination that a particular erasure request must be granted or rejected.
- The application does not yet implement identity/authority verification, patient-facing status tracking, grievance escalation, legal hold review, backup expiry/purge, processor propagation, or a full staff role/approval separation inside MediLoop.
- The clinic must determine applicable retention duties before approving deletion. Only allowlisted reason and retention-basis codes are accepted; never submit patient names, phone numbers, diagnoses or complaint text.
- D1 migration application and live credentials are operational prerequisites; source code alone does not complete deployment.
