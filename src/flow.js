// src/flow.js
// Fixed (non-AI) screening questions. The server owns the questions AND the choices,
// so the AI can never invent or corrupt an option list.

export const MAX_AI_QUESTIONS = 3;

const OTHER = { id: "other", label: "Type your answer", text: "required" };

export const SITE_QUESTION = {
  id: "site",
  kind: "fixed",
  type: "radio",
  text: "I have a problem with my…",
  options: [
    { id: "ear", label: "Ear" },
    { id: "nose", label: "Nose" },
    { id: "throat", label: "Throat" },
  ],
};

const YES_NO_NOTSURE = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "unsure", label: "Not sure" },
];

// type: "single" | "multi" | "yes_no" | "text" | "radio"
// option.text: "required" (must type when chosen) | "optional"; option.exclusive: clears other picks
export const EAR_QUESTIONS = [
  { id: "ear_side", kind: "fixed", type: "single", text: "Which ear is affected?",
    options: [{ id: "left", label: "Left" }, { id: "right", label: "Right" }, { id: "both", label: "Both" }] },
  { id: "ear_feel", kind: "fixed", type: "multi", text: "What are you feeling? (choose all that apply)",
    options: [
      { id: "itching", label: "Itching" }, { id: "pain", label: "Pain" }, { id: "blocked", label: "Blocked" },
      { id: "dizziness", label: "Dizziness" }, { id: "ringing", label: "Ringing" }, { id: "tinnitus", label: "Tinnitus" },
      { id: "swallowing", label: "Difficulty in swallowing" },
      { id: "nothing", label: "Nothing", exclusive: true }, OTHER,
    ] },
  { id: "ear_days", kind: "fixed", type: "single", text: "Since how many days?",
    options: [
      { id: "d1_2", label: "1-2 days" }, { id: "d3_5", label: "3-5 days" }, { id: "d5_7", label: "5-7 days" }, OTHER,
    ] },
  { id: "ear_discharge", kind: "fixed", type: "single", text: "Is there any discharge from the ear?",
    options: [
      { id: "yellow", label: "Yes - Yellow color" }, { id: "pus", label: "Yes - Pus" },
      { id: "watery", label: "Yes - Watery" }, { id: "none", label: "No discharge" },
    ] },
  { id: "ear_medication", kind: "fixed", type: "single", text: "Have you tried any medication?",
    options: [
      { id: "paracetamol", label: "Yes - Paracetamol" }, { id: "antibiotic", label: "Yes - Antibiotic" },
      { id: "none", label: "Not tried" },
    ] },
  { id: "ear_buds", kind: "fixed", type: "single", text: "Do you use ear buds?",
    options: [
      { id: "often", label: "Yes - often" }, { id: "sometimes", label: "Yes - sometimes" }, { id: "no", label: "Not at all" },
    ] },
  { id: "ear_recent", kind: "fixed", type: "multi", text: "In the last few days, did you have any of these? (choose all that apply)",
    options: [
      { id: "fever", label: "Had fever" }, { id: "rain", label: "Got wet in rain" },
      { id: "water", label: "Water went into the ear" },
      { id: "nothing", label: "Nothing", exclusive: true }, OTHER,
    ] },
  { id: "ear_allergy", kind: "fixed", type: "single", text: "Do you have any allergy?",
    options: [{ id: "yes", label: "Yes", text: "optional" }, { id: "no", label: "No" }] },
  { id: "ear_condition", kind: "fixed", type: "multi", text: "Do you have any medical condition? (choose all that apply)",
    options: [
      { id: "bp", label: "Blood pressure" }, { id: "diabetes", label: "Diabetic" },
      { id: "none", label: "None", exclusive: true }, OTHER,
    ] },
];

export const FIXED_SETS = { ear: EAR_QUESTIONS };

// Deterministic follow-ups, used when the AI is unavailable or returns something unusable.
// Ordered by clinical priority. `when(a)` receives the answer helper.
const EAR_FALLBACKS = [
  { id: "fb_facial", text: "Have you noticed any weakness or drooping on one side of your face?", type: "yes_no", redFlagIfYes: true },
  { id: "fb_hearing", text: "Have you noticed any drop in your hearing in this ear?", type: "yes_no" },
  { id: "fb_touch", text: "Is the ear painful when you touch or pull it?", type: "yes_no", when: (a) => a.has("ear_feel", "pain") },
  { id: "fb_spin", text: "When you feel dizzy, does the room feel like it is spinning?", type: "yes_no", when: (a) => a.has("ear_feel", "dizziness") },
  { id: "fb_swelling", text: "Is there any swelling or redness in or around the ear?", type: "yes_no" },
  { id: "fb_past", text: "Have you had ear infections or ear surgery in the past?", type: "yes_no" },
  { id: "fb_cold", text: "Do you have a cold, blocked nose or sore throat at the moment?", type: "yes_no" },
];

// ---------- helpers ----------
export function patientAnswer(session, qid) {
  return [...(session.conversation || [])].reverse().find((x) => x.role === "patient" && x.qid === qid) || null;
}
export function answered(session, qid) { return !!patientAnswer(session, qid); }

export function siteOf(session) {
  const a = patientAnswer(session, "site");
  return a?.selected?.[0]?.id || null;
}

export function answerHelper(session) {
  return {
    has: (qid, optId) => !!patientAnswer(session, qid)?.selected?.some((s) => s.id === optId),
    ids: (qid) => (patientAnswer(session, qid)?.selected || []).map((s) => s.id),
  };
}

export function questionDef(session, qid) {
  const site = siteOf(session);
  if (qid === "site") return SITE_QUESTION;
  const fixed = (FIXED_SETS[site] || []).find((q) => q.id === qid);
  if (fixed) return fixed;
  // AI / fallback follow-ups store their own input spec on the assistant entry
  const entry = [...(session.conversation || [])].reverse().find((x) => x.role === "assistant" && x.qid === qid);
  return entry ? entry.question_def : null;
}

export function nextFixedQuestion(session, site) {
  const set = FIXED_SETS[site];
  if (!set) return null;
  return set.find((q) => !answered(session, q.id)) || null;
}

export function followUpsAsked(session) {
  return (session.conversation || []).filter((x) => x.role === "assistant" && x.kind === "followup").length;
}

export function fallbackFollowUp(session, site) {
  if (site !== "ear") return null;
  const a = answerHelper(session);
  const asked = new Set((session.conversation || []).filter((x) => x.role === "assistant").map((x) => x.qid));
  return EAR_FALLBACKS.find((q) => !asked.has(q.id) && (!q.when || q.when(a))) || null;
}

export function inputSpec(q) {
  // What the browser is allowed to see: never the AI's reasoning, only the input spec.
  if (q.type === "yes_no") return { type: "yes_no", options: YES_NO_NOTSURE };
  if (q.type === "text") return { type: "text", options: [] };
  return { type: q.type, options: q.options };
}

// Validate a browser answer against the question actually asked. Returns { ok, message, selected } or { ok:false, error }.
export function resolveAnswer(q, body) {
  const spec = inputSpec(q);
  if (spec.type === "text") {
    const t = String(body?.text ?? body?.message ?? "").trim();
    if (!t || t.length > 300) return { ok: false, error: "Please enter a short answer." };
    return { ok: true, message: t, selected: [{ id: "text", label: t, text: t }] };
  }
  const picks = Array.isArray(body?.selected) ? body.selected : [];
  if (!picks.length) return { ok: false, error: "Please choose an option." };
  if (spec.type !== "multi" && picks.length !== 1) return { ok: false, error: "Please choose one option." };
  const selected = [];
  const seen = new Set();
  for (const p of picks) {
    const opt = spec.options.find((o) => o.id === p?.id);
    if (!opt || seen.has(opt.id)) return { ok: false, error: "That choice is not valid for this question." };
    seen.add(opt.id);
    const typed = String(p?.text ?? "").trim().slice(0, 200);
    if (opt.text === "required" && !typed) return { ok: false, error: "Please type your answer." };
    selected.push({ id: opt.id, label: opt.label, text: opt.text ? typed : "" });
  }
  if (selected.length > 1 && selected.some((s) => spec.options.find((o) => o.id === s.id)?.exclusive)) {
    return { ok: false, error: `"${selected.find((s) => spec.options.find((o) => o.id === s.id)?.exclusive).label}" cannot be combined with other choices.` };
  }
  const message = selected.map((s) => (s.id === "other" ? s.text : s.text ? `${s.label} (${s.text})` : s.label)).join(", ");
  return { ok: true, message, selected };
}

// ---------- deterministic Contract 1.1 for the ear flow ----------
const RED_FLAG_TEXT = /facial (weakness|droop|paralysis)|face (is )?(drooping|numb)|can'?t breathe|difficulty breathing|unconscious|heavy bleeding/i;

const val = (s) => (s.id === "other" ? s.text : s.text ? `${s.label} (${s.text})` : s.label);
const list = (session, qid) => (patientAnswer(session, qid)?.selected || []).map(val);
const one = (session, qid) => list(session, qid)[0] || "";
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export function buildEarContract(session, base) {
  const feel = list(session, "ear_feel").filter((x) => x !== "Nothing");
  const sideId = patientAnswer(session, "ear_side")?.selected?.[0]?.id;
  const laterality = sideId === "left" ? "left" : sideId === "right" ? "right" : sideId === "both" ? "bilateral" : "unknown";
  const days = one(session, "ear_days");
  const dischargeSel = patientAnswer(session, "ear_discharge")?.selected?.[0];
  const dischargeTxt = dischargeSel ? (dischargeSel.id === "none" ? "" : lc(dischargeSel.label.replace(/^Yes - /, ""))) : "";
  const recent = list(session, "ear_recent").filter((x) => x !== "Nothing");
  const med = patientAnswer(session, "ear_medication")?.selected?.[0];
  const buds = one(session, "ear_buds");
  const allergy = patientAnswer(session, "ear_allergy")?.selected?.[0];
  const conds = patientAnswer(session, "ear_condition")?.selected || [];
  const condItems = conds.filter((c) => c.id !== "none").map(val);

  const followUps = (session.conversation || [])
    .filter((x) => x.role === "patient" && x.kind === "followup")
    .map((x) => ({ q: x.question, a: x.message, qid: x.qid }));

  const associated = [];
  if (dischargeTxt) associated.push(`ear discharge (${dischargeTxt})`);
  if (recent.some((r) => /fever/i.test(r))) associated.push("fever");

  const qualifiers = [];
  if (days) qualifiers.push(`Duration reported: ${days}`);
  if (buds) qualifiers.push(`Ear bud use: ${buds}`);
  const exposures = recent.filter((r) => !/fever/i.test(r));
  if (exposures.length) qualifiers.push(`Recent: ${exposures.map(lc).join(", ")}`);
  followUps.forEach((f) => qualifiers.push(`${f.q} ${f.a}`));

  const redFlags = [];
  followUps.forEach((f) => {
    const def = EAR_FALLBACKS.find((x) => x.id === f.qid);
    if (def?.redFlagIfYes && /^yes$/i.test(f.a)) redFlags.push({ text: "Facial weakness or drooping reported", source: "patient_reported", confidence: "high" });
  });
  const typedText = (session.conversation || []).filter((x) => x.role === "patient").map((x) => x.message).join(" \n ");
  if (RED_FLAG_TEXT.test(typedText)) redFlags.push({ text: "Patient typed a possible urgent symptom — see answers", source: "patient_reported", confidence: "medium" });
  redFlags.forEach((r, i) => { r.id = `rf${i + 1}`; });

  const complaint = {
    id: "c1",
    text: feel.length ? `Ear: ${feel.map(lc).join(", ")}` : "Ear symptoms",
    laterality,
    duration: { value: null, unit: "unknown" },
    course: "unknown",
    severity: "unknown",
    associated_symptoms: associated,
    qualifiers,
    impact: "",
    treatment_tried: med
      ? med.id === "none" ? { status: "none", items: [] } : { status: "reported", items: [med.id === "paracetamol" ? "Paracetamol" : "Antibiotic"] }
      : { status: "unknown", items: [] },
    priority: "chief",
    source: "screening",
    confidence: "high",
  };

  const allergies = !allergy ? { status: "unknown", items: [] }
    : allergy.id === "no" ? { status: "none_reported", items: [] }
    : { status: "reported", items: [allergy.text || "Allergy reported (details not given)"] };
  const medical_history = !conds.length ? { status: "unknown", items: [] }
    : conds.some((c) => c.id === "none") ? { status: "none_reported", items: [] }
    : { status: "reported", items: condItems };

  const summary = [
    `Problem: ${complaint.text}`,
    laterality !== "unknown" ? `Side: ${laterality === "bilateral" ? "both ears" : laterality}` : "",
    days ? `Duration: ${days}` : "",
    dischargeSel ? `Discharge: ${dischargeSel.label}` : "",
    associated.some((x) => x === "fever") ? "Fever: reported in last few days" : "",
    med ? `Treatment tried: ${complaint.treatment_tried.items.join(", ") || "none"}` : "",
    buds ? `Ear bud use: ${buds}` : "",
    exposures.length ? `Recent: ${exposures.map(lc).join(", ")}` : "",
    allergy ? `Allergies: ${allergies.status === "none_reported" ? "none reported" : allergies.items.join(", ")}` : "",
    conds.length ? `Medical history: ${medical_history.status === "none_reported" ? "none reported" : condItems.join(", ")}` : "",
    ...followUps.map((f) => `Follow-up — ${f.q} ${f.a}`),
  ].filter(Boolean).join("\n");

  return {
    ...base,
    complaints: [complaint],
    allergies,
    medical_history,
    red_flags: redFlags,
    completion: { ...base.completion, complaints: true, allergies: !!allergy, medical_history: conds.length > 0 },
    summary,
    screening_status: redFlags.length ? "urgent" : "completed",
    data_quality_notes: ["structured_fixed_questions"],
  };
}
