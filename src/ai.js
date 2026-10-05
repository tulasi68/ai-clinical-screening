// src/ai.js
// Deterministic clinical screening — no external LLM.
//
// Sarvam removed. Every path is now:
//   - ENT ear      → buildEarContract(session, base)
//   - ENT nose     → buildNoseContract(session, base)
//   - ENT throat   → buildThroatContract(session, base)
//   - GM / generic → buildDeterministicContract(session, base)
//
// server.js continues to import { nextStep, consolidate, nextFollowUp } from this
// file with the same signatures, so no server changes are required.

import {
  siteOf,
  buildEarContract,
  buildNoseContract,
  buildThroatContract,
  buildDeterministicContract,
  fallbackFollowUp,
  followUpsAsked,
  MAX_AI_QUESTIONS,
} from "./flow.js";

/**
 * nextStep — retained for backward compatibility.
 * After the nose/throat fixed sets land in flow.js, this path is never reached
 * for ENT. If it is reached (unknown specialty, defensive default), we complete
 * cleanly so the patient is never stuck on a missing question.
 */
export async function nextStep(session) {
  const uiLang = String(session?.patient?.ui_language || "en").toLowerCase();
  return {
    status: "COMPLETE",
    message:
      uiLang === "kn"
        ? "ಧನ್ಯವಾದಗಳು. ಸಮಾಲೋಚನೆಗೂ ಮುನ್ನ ವೈದ್ಯರು ಪರಿಶೀಲಿಸುವಂತೆ ಎಲ್ಲವನ್ನೂ ದಾಖಲಿಸಿದ್ದೇನೆ."
        : "Thank you for going through this with me. I've noted the details for the doctor to review before your consultation.",
    reason: "deterministic_complete",
  };
}

/**
 * nextFollowUp — pure fallback. No LLM attempt.
 * Uses the site-specific fallback pool (EAR_FALLBACKS / NOSE_FALLBACKS /
 * THROAT_FALLBACKS) declared in flow.js.
 */
export async function nextFollowUp(session, site) {
  const asked = followUpsAsked(session);
  if (asked >= MAX_AI_QUESTIONS) return null;

  const f = fallbackFollowUp(session, site);
  if (!f) return null;

  const uiLang = String(session?.patient?.ui_language || "en").toLowerCase();
  const text = uiLang === "kn" && f.text_kn ? f.text_kn : f.text;

  return {
    qid: f.id,
    text,
    text_kn: f.text_kn,
    type: f.type || "yes_no",
    redFlagIfYes: !!f.redFlagIfYes,
  };
}

/**
 * consolidate — deterministic. Routes by site.
 * Returns a full Contract v1.1 output object.
 */
export async function consolidate(session) {
  const startedAt = session?.created_at || session?.started_at || null;

  const base = {
    contract_version: "1.1",
    screening_id: session.screening_id,
    screening: {
      screening_id: session.screening_id,
      status: "completed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    },
    patient: {
      patient_id: session.patient?.patient_id || null,
      name: session.patient?.patient_name || null,
      age: session.patient?.age ?? null,
      age_unit: "Y",
      gender: session.patient?.gender || null,
      phone_last10:
        String(session.patient?.phone || "").replace(/\D/g, "").slice(-10) || null,
      date: new Date().toISOString().slice(0, 10),
    },
    vitals: {
      bp: null,
      pulse: null,
      temperature: null,
      spo2: null,
      weight: null,
      respiratory_rate: null,
      rbs: null,
    },
    complaints: [],
    allergies: { status: "unknown", items: [] },
    medical_history: { status: "unknown", items: [] },
    current_medications: { status: "unknown", items: [] },
    red_flags: [],
    provenance: {
      complaints: "patient_reported",
      allergies: "patient_reported",
      medical_history: "patient_reported",
      current_medications: "patient_reported",
      vitals: {},
    },
    completion: {
      patient_details: true,
      vitals: false,
      complaints: false,
      allergies: false,
      medical_history: false,
      current_medications: false,
      screening_complete: true,
    },
    summary: session.patient?.complaint || "See conversation transcript.",
    screening_status: "completed",
    patient_approved: false,
    submitted_at: null,
    data_quality_notes: ["deterministic_no_llm"],
  };

  const spec = String(session?.patient?.specialty || "ent")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_") || "ent";

  // ENT — route by site (site comes from the SITE_QUESTION answer)
  if (spec === "ent") {
    const site = siteOf(session);
    if (site === "ear") return buildEarContract(session, base);
    if (site === "nose") return buildNoseContract(session, base);
    if (site === "throat") return buildThroatContract(session, base);
  }

  // GM / generic / unknown non-ENT
  return buildDeterministicContract(session, base);
}
