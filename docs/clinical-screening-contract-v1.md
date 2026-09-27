# AI Clinical Screening → MediLoop Contract v1.1

AI Clinical Screening is the producer of Contract 1.1.

The contract is deliberately semantic: every patient answer is assigned to the clinical field/question it answers. MediLoop never has to reconstruct meaning from the order of raw answers.

## Producer responsibilities

- Conduct one-question-at-a-time history taking.
- Consolidate explicit patient answers into named clinical fields.
- Normalize complaints into concise clinical shorthand.
- Preserve duration, laterality, course, severity, associated symptoms, impact, and treatment tried when explicitly stated.
- Preserve allergies, medical history, and current medications separately.
- Preserve patient-reported provenance.
- Represent explicitly identified concerning symptoms without diagnosing them.
- Return valid Contract 1.1 JSON.
- Never prescribe, diagnose, or recommend treatment.

## Contract fields

contract_version; screening; patient; vitals; complaints[]; allergies; medical_history; current_medications; red_flags[]; provenance; completion.

Compatibility fields used by the patient review UI and MediLoop integration are also retained: summary, screening_status, patient_approved, submitted_at, and data_quality_notes.

### Complaint structure

Each complaint carries the meaning of the answers directly:

- text — named problem, e.g. ear blockage
- laterality — left / right / bilateral / midline / not applicable / unknown
- duration — value + unit
- course — improving / worsening / stable / intermittent / unknown
- severity — mild / moderate / severe / unknown
- associated_symptoms[] — e.g. dizziness, discharge
- qualifiers[] — useful details such as spinning sensation
- impact — explicit functional impact such as unable to sleep
- treatment_tried — none / reported / unknown plus named items

This prevents outputs such as:

ear / blocked / left / 3 days / worse / dizziness / discharge / spinning / not able to sleep / not tried

from reaching MediLoop as an unexplained sequence.

Instead, the same information becomes:

- Problem: ear blockage
- Side: left
- Duration: 3 days
- Course: worsening
- Associated symptoms: dizziness, discharge
- Details: spinning sensation
- Impact: unable to sleep
- Treatment tried: none

## Other clinical fields

- allergies records explicit allergy information.
- medical_history records explicit positive and negative history such as high blood pressure and no diabetes.
- current_medications records medications explicitly reported by the patient.
- red_flags[] contains only explicitly identified concerning symptoms. A bare yes is not converted into a red flag without knowing the question it answers.

## Consumer boundary

MediLoop retrieves the submitted output through GET /api/screenings/:id/output authenticated with the server-to-server API key.

MediLoop stores the complete structured object and deterministically renders the patient-reported intake inside its Prescription workspace.

The doctor's actual prescription remains a separate editable field.

The service must not change field names without incrementing the contract version or maintaining backward compatibility.

## Guided patient answers

The patient browser now presents selectable answer boxes below each question. Each selected option carries a stable key, label and semantic value. The server stores the selected option together with the question that was displayed, so consolidation receives explicit question→answer context instead of an unexplained answer sequence.
