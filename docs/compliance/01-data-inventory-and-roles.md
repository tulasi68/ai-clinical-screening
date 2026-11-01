# Phase 1 — Data inventory, purposes and role allocation

**Status:** Initial source-informed inventory; clinic/vendor confirmation required.  
**Applies to:** AI Clinical Screening.  
**Not a legal opinion or certification.**

## 1. System boundary

This is a separate patient-facing screening service, not the MediLoop clinic database. MediLoop sends authenticated clinic-scoped requests; Screening stores its own screening sessions, conversation and output in Cloudflare D1. The clinic/hospital generally determines the patient-care purpose. The Screening operator is intended to process data on documented clinic/MediLoop instructions, subject to contract and actual conduct. If the operator determines independent purposes (for example, product analytics or model training), its role must be reassessed.

## 2. Preliminary data inventory

| Data set | Examples observed in source/schema | Purpose | Storage / recipients to verify |
|---|---|---|---|
| Screening identity | Screening ID, patient name, age, gender, phone | Link screening to patient encounter and support patient access | D1 `screening_sessions.patient_json`; MediLoop integration |
| Health information | Complaint, specialty, follow-up details, prior summary/prescription/complaint | Pre-consultation history | D1 patient_json |
| Conversation | Assistant questions and patient answers, timestamps, question IDs | Capture structured screening responses | D1 conversation_json |
| Derived output | Screening summary, status, patient approval metadata | Return information to treating clinic | D1 `screening_outputs.output_json`; MediLoop service read |
| Consent | Purpose, notice version, grant/withdraw event, time, language, method, channel, actor, evidence JSON | Evidence of screening consent and withdrawal | D1 `screening_consent_events` |
| Patient bearer/session credential | Token hash and expiry; redeemed cookie credential | Patient session authentication | D1 credential columns; browser HttpOnly cookie |
| Clinic service credential | Tenant key map / shared-key migration setting | Authenticate MediLoop service calls | Managed runtime secret/config; must not be logged |
| Operational logs | Request metadata, errors, platform logs | Security and availability | Worker/platform logging; payload redaction needs verification |

## 3. Data-flow review checklist

1. MediLoop server → Screening create endpoint with clinic identifier and service credential.
2. Screening generates a one-time patient URL; trusted configured patient-app URL only.
3. Patient browser → token redemption → HttpOnly session cookie → D1.
4. Patient answers → session JSON updates → consent checks before question/summary/submit.
5. Screening output → authenticated MediLoop status/output read.
6. Consent withdrawal → append-only event; further screening access blocked.
7. Cloudflare Worker, D1, platform logs, backups and support access → verify region, retention, subprocessors and access.

Confirm whether WhatsApp link delivery is performed by this service or MediLoop in each deployed configuration. Identify every external AI/model API and ensure no patient content is sent to unapproved services.

## 4. Role and responsibility register

| Party | Proposed role | Must be confirmed |
|---|---|---|
| Clinic/hospital | Data Fiduciary for patient-care screening purpose | Legal entity, purpose, patient notice, rights contact, retention |
| MediLoop operator | Processor for clinic workflow and integration | Contract and exact instructions |
| Screening operator | Processor/subprocessor for screening workflow unless independent purposes exist | Contract, access, retention, incident notification, deletion |
| Cloudflare | Hosting/database processor/subprocessor | DPA, region, support access, logs, backup and deletion |
| Messaging/AI provider | Undetermined until actual call paths and configuration are verified | Payload, purpose, region, retention and training terms |

## 5. Decisions requiring owner confirmation

Legal entities, clinic contact, privacy/grievance contact, approved purposes, languages, clinical record retention, data-region constraints, minor-patient workflow, vendor/subprocessor list, cross-border transfers and whether any product analytics/model training uses personal data.

## 6. Acceptance criteria

Every field and endpoint must map to a purpose, actor, tenant, recipient, location, retention and owner. Browser storage, logs, backups, support access and downstream MediLoop copies are part of the inventory.
