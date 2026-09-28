import { buildFallbackFromConversation } from "./fallbackConsolidate.js";
// TEMPORARY STUB - full restore in progress
export async function nextStep(session) {
  return { status: "COMPLETE", message: "Thank you. The doctor will review your details.", reason: "temp_stub" };
}
export async function consolidate(session) {
  const base = {
    contract_version: "1.1", screening_id: session.screening_id,
    screening: { screening_id: session.screening_id, status: "completed", started_at: session.created_at || null, completed_at: new Date().toISOString() },
    patient: { name: session.patient?.patient_name || null, age: session.patient?.age ?? null, age_unit: "Y", gender: session.patient?.gender || null },
    vitals: {}, complaints: [], allergies: { status: "unknown", items: [] }, medical_history: { status: "unknown", items: [] }, current_medications: { status: "unknown", items: [] },
    red_flags: [], provenance: {}, completion: { screening_complete: true },
    summary: "", screening_status: "completed", patient_approved: false, submitted_at: null, data_quality_notes: []
  };
  return buildFallbackFromConversation(session, base);
}
