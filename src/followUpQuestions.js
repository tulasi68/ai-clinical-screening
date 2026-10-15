/**
 * Short fixed question set used when session.patient.is_follow_up === true.
 * Keeps the patient path short: change since last visit, adherence, new symptoms, side effects.
 */

const OTHER = {
  id: "other",
  label: "Type your answer",
  label_kn: "ನಿಮ್ಮ ಉತ್ತರ ಬರೆಯಿರಿ",
  text: "required",
};

const YES_NO_NOTSURE = [
  { id: "yes", label: "Yes", label_kn: "ಹೌದು" },
  { id: "no", label: "No", label_kn: "ಇಲ್ಲ" },
  { id: "unsure", label: "Not sure", label_kn: "ಖಚಿತವಿಲ್ಲ" },
];

export const FOLLOWUP_QUESTIONS = [
  {
    id: "fu_same_problem",
    kind: "fixed",
    type: "single",
    text: "Is this a follow-up for the same problem as last visit?",
    text_kn: "ಇದು ಹಿಂದಿನ ಭೇಟಿಯ ಅದೇ ಸಮಸ್ಯೆಗೆ ಮರುಪರಿಶೀಲನೆಯೇ?",
    options: [
      { id: "yes_same", label: "Yes — same problem", label_kn: "ಹೌದು — ಅದೇ ಸಮಸ್ಯೆ" },
      { id: "partly", label: "Partly related", label_kn: "ಭಾಗಶಃ ಸಂಬಂಧಿತ" },
      { id: "new", label: "No — new problem", label_kn: "ಇಲ್ಲ — ಹೊಸ ಸಮಸ್ಯೆ" },
    ],
  },
  {
    id: "fu_feeling",
    kind: "fixed",
    type: "single",
    text: "Compared to last visit, how are you feeling?",
    text_kn: "ಹಿಂದಿನ ಭೇಟಿಗೆ ಹೋಲಿಸಿದರೆ ನೀವು ಹೇಗಿದ್ದೀರಿ?",
    options: [
      { id: "better", label: "Better", label_kn: "ಉತ್ತಮ" },
      { id: "same", label: "Same", label_kn: "ಹಾಗೆಯೇ" },
      { id: "worse", label: "Worse", label_kn: "ಕೆಟ್ಟದಾಗಿದೆ" },
    ],
  },
  {
    id: "fu_medicines",
    kind: "fixed",
    type: "single",
    text: "Are you still taking the medicines given last time?",
    text_kn: "ಹಿಂದಿನ ಬಾರಿ ಕೊಟ್ಟ ಔಷಧಗಳನ್ನು ಇನ್ನೂ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದ್ದೀರಾ?",
    options: [
      { id: "yes_all", label: "Yes — all as advised", label_kn: "ಹೌದು — ಸಲಹೆಯಂತೆ ಎಲ್ಲಾ" },
      { id: "some", label: "Some of them", label_kn: "ಕೆಲವು ಮಾತ್ರ" },
      { id: "stopped", label: "Stopped", label_kn: "ನಿಲ್ಲಿಸಿದೆ" },
      { id: "never", label: "Did not start", label_kn: "ಪ್ರಾರಂಭಿಸಲಿಲ್ಲ" },
      { id: "na", label: "No medicines last time", label_kn: "ಹಿಂದಿನ ಬಾರಿ ಔಷಧ ಇರಲಿಲ್ಲ" },
    ],
  },
  {
    id: "fu_side_effects",
    kind: "fixed",
    type: "single",
    text: "Any side effects from the previous treatment?",
    text_kn: "ಹಿಂದಿನ ಚಿಕಿತ್ಸೆಯಿಂದ ಯಾವುದೇ ಅಡ್ಡಪರಿಣಾಮಗಳಿವೆಯೇ?",
    options: [
      { id: "none", label: "No side effects", label_kn: "ಅಡ್ಡಪರಿಣಾಮಗಳಿಲ್ಲ" },
      { id: "mild", label: "Mild side effects", label_kn: "ಸೌಮ್ಯ ಅಡ್ಡಪರಿಣಾಮಗಳು", text: "optional" },
      { id: "significant", label: "Significant side effects", label_kn: "ಗಂಭೀರ ಅಡ್ಡಪರಿಣಾಮಗಳು", text: "optional" },
    ],
  },
  {
    id: "fu_new_symptoms",
    kind: "fixed",
    type: "multi",
    text: "Any new symptoms since last visit? (choose all that apply)",
    text_kn: "ಹಿಂದಿನ ಭೇಟಿಯ ನಂತರ ಹೊಸ ಲಕ್ಷಣಗಳಿವೆಯೇ? (ಅನ್ವಯವಾಗುವುದನ್ನೆಲ್ಲಾ ಆಯ್ಕೆ ಮಾಡಿ)",
    options: [
      { id: "fever", label: "Fever", label_kn: "ಜ್ವರ" },
      { id: "pain_worse", label: "Pain increased", label_kn: "ನೋವು ಹೆಚ್ಚಾಗಿದೆ" },
      { id: "discharge", label: "Discharge / fluid", label_kn: "ಸ್ರಾವ" },
      { id: "swelling", label: "Swelling", label_kn: "ಊತ" },
      { id: "breathing", label: "Breathing difficulty", label_kn: "ಉಸಿರಾಟದ ತೊಂದರೆ" },
      { id: "nothing", label: "Nothing new", label_kn: "ಹೊಸದೇನೂ ಇಲ್ಲ", exclusive: true },
      OTHER,
    ],
  },
  {
    id: "fu_free_note",
    kind: "fixed",
    type: "single",
    text: "Anything else you want the doctor to know?",
    text_kn: "ವೈದ್ಯರಿಗೆ ತಿಳಿಸಬೇಕಾದ ಬೇರೆ ಏನಾದರೂ ಇದೆಯೇ?",
    options: [
      { id: "none", label: "Nothing else", label_kn: "ಬೇರೆ ಏನೂ ಇಲ್ಲ" },
      { id: "yes", label: "Yes — I will type", label_kn: "ಹೌದು — ನಾನು ಬರೆಯುತ್ತೇನೆ", text: "required" },
    ],
  },
];

export function isFollowUpSession(s) {
  return Boolean(s?.patient?.is_follow_up);
}

export function nextFollowUpQuestion(s) {
  if (!isFollowUpSession(s)) return null;
  const answered = new Set(
    (s.conversation || [])
      .filter((x) => x.role === "patient" && x.qid)
      .map((x) => x.qid)
  );
  return FOLLOWUP_QUESTIONS.find((q) => !answered.has(q.id)) || null;
}

export function followUpQuestionDef(qid) {
  return FOLLOWUP_QUESTIONS.find((q) => q.id === qid) || null;
}

/** Build a short human-readable prior context line for prompts / summary. */
export function priorContextLine(s) {
  const p = s?.patient || {};
  const bits = [];
  if (p.days_since_last_visit != null) bits.push(`${p.days_since_last_visit} days since last visit`);
  if (p.prior_complaint) bits.push(`Prior: ${String(p.prior_complaint).slice(0, 120)}`);
  if (p.prior_prescription) bits.push(`Prior Rx: ${String(p.prior_prescription).slice(0, 120)}`);
  return bits.join(" · ") || "";
}
