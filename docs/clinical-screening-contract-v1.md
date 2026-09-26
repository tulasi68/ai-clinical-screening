# AI Clinical Screening → MediLoop Contract v1

This service is the producer of Contract 1.0.

The consolidation step returns structured patient-reported information for MediLoop. It does not generate the prescription or print representation.

## Producer responsibilities

- Conduct one-question-at-a-time history taking.
- Consolidate explicit patient answers.
- Normalize complaints into concise clinical shorthand.
- Preserve duration and laterality when explicitly stated.
- Preserve provenance.
- Represent reported concerning symptoms without diagnosing them.
- Return valid Contract 1.0 JSON.
- Never prescribe, diagnose, or recommend treatment.

## Contract fields

`contract_version`
`screening`
`patient`
`vitals`
`complaints[]`
`allergies`
`current_medications`
`red_flags[]`
`provenance`
`completion`

Compatibility fields used by the patient review UI and MediLoop integration are also retained: `summary`, `screening_status`, `patient_approved`, `submitted_at`, and `data_quality_notes`.

## Consumer boundary

MediLoop retrieves the submitted output through:

GET /api/screenings/:id/output

authenticated with the server-to-server API key.

MediLoop stores the complete structured object and deterministically renders the patient-reported intake inside its Prescription workspace.

The service must not change field names without incrementing the contract version or maintaining backward compatibility.
