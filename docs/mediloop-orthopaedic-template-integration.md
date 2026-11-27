# MediLoop Orthopaedic Smart Templates — Screening Integration Boundary

**Repository:** tulasi68/ai-clinical-screening  
**Related application:** tulasi68/mediloop-ai  
**Status:** Integration requirements / architecture note — no code or API contract change  
**Date:** 27 November 2026

## 1. Purpose

MediLoop is beginning an orthopaedic Clinical Smart Templates initiative. A doctor will select an anatomical region and a condition in two dropdowns. MediLoop will load a complete condition-specific consultation template with structured clinical fields and selectable options, aiming to eliminate routine doctor typing.

The full product and orthopaedic clinical content specification is maintained in the MediLoop repository:

https://github.com/tulasi68/mediloop-ai/blob/main/docs/orthopaedic-clinical-smart-templates.md

## 2. Responsibility boundary

AI Clinical Screening remains a pre-consultation patient-history collection service.

It collects and submits patient-reported information. It does not:
- Diagnose orthopaedic conditions.
- Generate doctor-observed examination findings.
- Confirm provisional or final diagnoses.
- Recommend or order investigations.
- Prescribe or select treatment.
- Complete a clinician's consultation template on the doctor's behalf.

MediLoop remains responsible for the clinical encounter, template selection, doctor assessment, diagnosis, investigation decisions, treatment and prescription.

## 3. Existing integration contract

Preserve the existing Contract 1.1 unless a separately reviewed and versioned change is approved.

Relevant structured information may include:
- Screening/session metadata and completion status.
- Patient demographics/context supplied for the session.
- Complaints: text, laterality, duration, course, severity, associated symptoms and functional impact where captured.
- Vitals where collected.
- Allergies.
- Medical history.
- Current medications.
- Patient-reported red flags.
- Provenance and completion metadata.
- Patient approval and submission status.

MediLoop must retain the distinction between patient-reported data and clinician-assessed data.

## 4. Orthopaedic screening relevance

For orthopaedic consultations, patient screening may collect relevant history such as:
- Main body area and side (right / left / both).
- Main complaint and duration.
- Onset and progression.
- Pain characteristics and severity.
- Functional impact (walking, stairs, lifting, reaching, gripping, sleep and daily activities as relevant).
- Associated symptoms (stiffness, swelling, numbness, tingling, weakness, instability, etc. as appropriate to the question branch).
- Trauma or injury history where relevant.
- Previous treatment, surgery or investigations where captured.
- Existing medical conditions.
- Allergies and current medications.
- Relevant warning symptoms.

These are patient responses, not examination results. The patient must not be asked to perform or report clinician-only examination manoeuvres as though they were objective findings.

The orthopaedic questionnaire pack should be reviewed against the surgeon's real case mix. Keep the question flow deterministic and structured, with stable option identifiers and semantic output.

## 5. How MediLoop should consume the screening output

When a doctor selects a region and condition in MediLoop:

1. MediLoop loads the condition-specific consultation template.
2. If a submitted screening intake exists, MediLoop displays relevant patient-reported answers in the appropriate history sections.
3. Each imported answer retains patient-reported provenance.
4. The doctor may review, confirm, correct or supplement history according to the MediLoop workflow.
5. Examination findings remain empty / not assessed until entered by the doctor.
6. Diagnosis, investigations and treatment remain doctor-controlled.

Screening data must never silently prepopulate:
- Positive or negative physical examination findings.
- Normal examination statements.
- Provisional or final diagnosis.
- Investigation orders.
- Medication or treatment decisions.

If no screening response exists, is incomplete, or is not submitted/approved, the MediLoop consultation must still function. Missing screening data must not block the doctor from proceeding.

## 6. Compatibility and data integrity

- Keep the two repositories independent.
- Do not move MediLoop consultation templates into the patient screening UI.
- Do not duplicate patient or consultation ownership.
- Do not rename or reinterpret Contract 1.1 fields without explicit versioning and backward compatibility.
- Do not treat unasked or missing answers as negative.
- Preserve source, status, timestamp and provenance where available.
- Keep screening output as the patient-submitted source record; clinician corrections belong in MediLoop's own encounter record.
- Maintain the existing authenticated server-to-server API and consent workflow.

## 7. Testing requirements

1. Orthopaedic screening output can be retrieved through the existing contract.
2. Complaint laterality, duration, course, severity and associated symptoms map correctly when present.
3. Allergies and medication history retain their source and status.
4. Patient-reported red flags are displayed as reported, not clinician-confirmed findings.
5. No screening answer becomes a physical examination finding.
6. No diagnosis, investigation or prescription is generated by the screening service.
7. Incomplete or absent screening does not block MediLoop consultation.
8. Contract 1.1 consumers and existing specialty packs remain backward compatible.
9. Patient consent and explicit submission gates continue to be enforced.

## 8. Immediate scope

No code changes are requested by this note. The next step is to compare the existing orthopaedics question pack and Contract 1.1 output against the first orthopaedic template set, then identify any genuine history-collection gaps. Add questions only where they improve relevant patient history; do not duplicate the clinician's examination or decision-making workflow.

**Guiding principle: AI Clinical Screening collects the patient's story. MediLoop helps the doctor document and manage the consultation. The doctor remains in control of clinical findings and decisions.**
