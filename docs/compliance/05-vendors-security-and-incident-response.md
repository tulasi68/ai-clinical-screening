# Phase 5 — Vendor, security and incident response controls

**Status:** Baseline requirements; deployment/provider settings and contracts require verification.

## 1. Vendor register

| Service | Purpose | Data potentially exposed | Evidence required |
|---|---|---|---|
| Cloudflare Workers | Worker hosting and edge request processing | Request metadata and screening payload during processing | DPA, region, support access, logs, security configuration |
| Cloudflare D1 | Screening session, conversation, output and consent storage | Patient identity and health data | Region/account configuration, encryption, backup/export, access and deletion |
| MediLoop | Clinic integration and receipt of screening output | Screening status and summary, patient/clinic identifiers | Processor agreement, service credential handling, deletion/rights propagation |
| Messaging provider (if used) | Patient link delivery | Phone number, link and delivery metadata | Exact provider, payload, consent, retention and transfer |
| AI/model provider (if used) | Question generation or processing, if external calls exist | Potential patient answers and clinical context | Confirm actual call path, no-training/retention terms, DPA and approval |
| GitHub / CI | Source/build automation | Source code, configuration names, secrets if mishandled | Repo access, secret scanning, CI log retention |

Confirm actual vendors and data transfers from code and account settings; this table is not proof that every vendor receives patient data.

## 2. Security controls

- Tenant-key map with independently generated clinic credentials; rotate and revoke.
- Never log service keys, bearer tokens, patient tokens or clinical payloads.
- Distributed rate limits for patient and service endpoints.
- Verify clinic scope for every read/write/export/delete operation.
- Verify doctor isolation at MediLoop boundary and all Screening paths.
- D1 access limited to the Worker binding and authorised operators.
- TLS, cookie flags, CSP and anti-cache headers verified in deployed runtime.
- Append-only consent evidence and separate tamper-evident security audit.
- Dependency/SBOM scanning, vulnerability response and protected main.
- Backup/restore and deletion lifecycle documented and tested.

## 3. Incident response

Detect → preserve evidence → contain credentials/endpoint → assess data and clinics affected → notify MediLoop/clinic immediately under contract → assess CERT-In reporting and applicable deadline → assess DPDP breach duties when operative → notify affected persons/regulators where required → recover and validate → root-cause/corrective actions.

CERT-In directions list specified cyber incidents, require reporting within six hours of noticing or being brought to notice, and require secure retention of logs for a rolling 180 days within India. Confirm the official direction and applicability to the operator: https://www.cert-in.org.in/Directions70B.jsp

Keep an incident contact tree, designated CERT-In point of contact where applicable, on-call escalation, incident register and tabletop evidence.
