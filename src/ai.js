//src/ai.js
//
// Question flow is a fixed, purposeful checklist (not free-form LLM).
// Consolidation still uses Sarvam when available.

const SARVAM_API_URL = "https://api.sarvam.ai/v1/chat/completions";
const SARVAM_MODEL = process.env.SARVAM_MODEL || "sarvam-105b";

function getSarvamApiKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("Missing SARVAM_API_KEY environment variable.");
  return key;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractJsonObject(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* continue */
  }
  const start = cleaned.indexOf("{");
  if (start < 0) return null;
  for (let end = cleaned.lastIndexOf("}"); end > start; end = cleaned.lastIndexOf("}", end - 1)) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      /* try again */
    }
  }
  return null;
}

async function sarvamChat(messages, options = {}, attempt = 1) {
  const body = {
    model: SARVAM_MODEL,
    messages,
    temperature: options.temperature ?? 0.2,
    reasoning_effort: options.reasoning_effort ?? null,
    max_tokens: options.max_tokens ?? 500,
  };
  if (options.response_format) body.response_format = options.response_format;

  const response = await fetch(SARVAM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": getSarvamApiKey(),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code = data?.error?.code || "";
    const retriable =
      response.status === 503 ||
      response.status === 429 ||
      code === "model_overloaded" ||
      /timeout|overloaded/i.test(String(data?.error?.message || ""));
    if (retriable && attempt < 3) {
      await sleep(800 * attempt);
      return sarvamChat(messages, options, attempt + 1);
    }
    throw new Error(`Sarvam API error ${response.status}: ${JSON.stringify(data)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  const cleaned = String(content || "").trim();
  if (!cleaned) {
    if (attempt < 2) {
      await sleep(500);
      return sarvamChat(messages, options, attempt + 1);
    }
    throw new Error(`Sarvam returned no message content: ${JSON.stringify(data)}`);
  }
  return cleaned;
}

function normalizeSpecialty(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

function patientText(session) {
  return (session.conversation || [])
    .filter((x) => x.role === "patient")
    .map((x) => x.message)
    .join(" \n ")
    .toLowerCase();
}

function allText(session) {
  const complaint = String(session.patient?.complaint || "").toLowerCase();
  return (complaint + " \n " + patientText(session)).toLowerCase();
}

function detectSite(session) {
  const t = allText(session);
  const ear = /\bear\b|otalg|hearing|tinnitus|otitis|eardrum/.test(t);
  const nose = /\bnose\b|nasal|sinus|smell|sneeze|rhinit|blocked nose|runny/.test(t);
  const throat = /\bthroat\b|swallow|voice|tonsil|pharyng|sore throat/.test(t);
  const sites = [];
  if (ear) sites.push("ear");
  if (nose) sites.push("nose");
  if (throat) sites.push("throat");
  return sites;
}

function hasDuration(session) {
  const t = patientText(session);
  return /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|few|several)\s*(day|days|week|weeks|month|months|hour|hours)\b|\bsince\b|\byesterday\b|\btoday\b|\blast\s+(night|week|month)\b|\bfor\s+\d+/i.test(
    t
  );
}

function hasLocation(session) {
  const t = patientText(session);
  const sites = detectSite(session);
  // Laterality or specific place mentioned by patient
  if (/\bleft\b|\bright\b|\bboth\b|one side|both sides|middle|front|back of/.test(t)) return true;
  // If only throat (no laterality needed as often midline), accept "throat" as location once answered in detail step
  if (sites.length === 1 && sites[0] === "throat" && /throat/.test(t)) return true;
  return false;
}

function hasDetail(session) {
  const t = patientText(session);
  // Patient described what is happening (pain, blockage, discharge, etc.) beyond just naming the organ
  return /pain|ache|block|blockage|discharge|pus|bleed|itch|hearing|hear|ring|buzz|fever|cold|cough|swell|sore|burn|dry|voice|swallow|smell|sneeze|runny|congest|fullness|pressure|throb|sharp|mild|moderate|severe|cannot|can't|worse|better/i.test(
    t
  );
}

function hasMedicine(session) {
  const t = patientText(session);
  return /\b(no|not|none|nil|haven't|havent|never)\b.*\b(medicine|tablet|drop|syrup|antibiotic|medication)\b|\b(medicine|tablet|drop|syrup|antibiotic|medication|taking|took|using)\b/i.test(
    t
  );
}

function hasAllergy(session) {
  const t = patientText(session);
  return /\ballerg|\bno known|nka|\bnil\b|\bnone\b|\bno allergy|not allergic/i.test(t);
}

function hasSiteAnswer(session) {
  return detectSite(session).length > 0;
}

/**
 * Fixed purposeful ENT checklist — one step at a time, never repeats a step.
 *
 * 1. What is the problem? (ear / nose / throat)
 * 2. What is happening there?
 * 3. Since how many days?
 * 4. Where exactly is the problem? (left/right/both or area)
 * 5. Any medicine already taken?
 * 6. Any allergy?
 */
const ENT_STEPS = [
  {
    id: "site",
    done: hasSiteAnswer,
    question:
      "What is the main problem today — is it with your ear, nose, or throat?",
  },
  {
    id: "detail",
    done: hasDetail,
    question: (session) => {
      const sites = detectSite(session);
      if (sites.length === 1 && sites[0] === "ear") {
        return "What is happening in your ear — for example pain, blockage, discharge, reduced hearing, or itching?";
      }
      if (sites.length === 1 && sites[0] === "nose") {
        return "What is happening in your nose — for example blockage, runny nose, bleeding, reduced smell, or sneezing?";
      }
      if (sites.length === 1 && sites[0] === "throat") {
        return "What is happening in your throat — for example pain, difficulty swallowing, voice change, or dryness?";
      }
      if (sites.length > 1) {
        return `What exactly is happening in your ${sites.join(" and ")}? Please describe the main symptoms.`;
      }
      return "What exactly is happening — please describe the main symptoms in your own words.";
    },
  },
  {
    id: "duration",
    done: hasDuration,
    question: "Since how many days have you had this problem?",
  },
  {
    id: "location",
    done: hasLocation,
    question: (session) => {
      const sites = detectSite(session);
      if (sites.includes("ear") && !sites.includes("nose") && !sites.includes("throat")) {
        return "Where is the problem — left ear, right ear, or both ears?";
      }
      if (sites.includes("nose") && !sites.includes("ear") && !sites.includes("throat")) {
        return "Where is the problem — left side of the nose, right side, or both sides?";
      }
      if (sites.includes("throat") && sites.length === 1) {
        return "Is the throat pain more on the left, right, or in the middle / both sides?";
      }
      return "Where exactly is the problem located (left, right, both, or which area)?";
    },
  },
  {
    id: "medicine",
    done: hasMedicine,
    question:
      "Have you already taken any medicine or used any drops for this problem? If yes, which ones?",
  },
  {
    id: "allergy",
    done: hasAllergy,
    question: "Do you have any allergy to medicines or anything else?",
  },
];

function generalSteps() {
  return [
    {
      id: "site",
      done: (s) => patientText(s).length > 8 || String(s.patient?.complaint || "").length > 8,
      question: "What is the main problem you want the doctor to help with today?",
    },
    {
      id: "detail",
      done: hasDetail,
      question: "What exactly is happening? Please describe the main symptoms.",
    },
    {
      id: "duration",
      done: hasDuration,
      question: "Since how many days have you had this problem?",
    },
    {
      id: "location",
      done: hasLocation,
      question: "Where is the problem located in the body?",
    },
    {
      id: "medicine",
      done: hasMedicine,
      question: "Have you already taken any medicine for this? If yes, which ones?",
    },
    {
      id: "allergy",
      done: hasAllergy,
      question: "Do you have any allergy to medicines or anything else?",
    },
  ];
}

function getScript(session) {
  const specialty = normalizeSpecialty(session.patient?.specialty);
  if (
    specialty === "ent" ||
    specialty === "oto" ||
    specialty === "otolaryngology" ||
    specialty === "ear_nose_throat" ||
    !specialty
  ) {
    return ENT_STEPS;
  }
  return generalSteps();
}

function nextScriptedStep(session) {
  const script = getScript(session);
  for (const step of script) {
    if (!step.done(session)) {
      const message = typeof step.question === "function" ? step.question(session) : step.question;
      return {
        status: "QUESTION",
        message,
        reason: `scripted_${step.id}`,
      };
    }
  }
  return {
    status: "COMPLETE",
    message: "Thank you. We have the information needed for your doctor to review before the consultation.",
    reason: "script_complete",
  };
}

function detectUrgent(session) {
  const t = allText(session);
  return /cannot breathe|can't breathe|not breathing|unconscious|passed out|uncontrolled bleeding|coughing blood|vomiting blood|sudden weakness on one side|face droop|stroke|chest pain with breathlessness/i.test(
    t
  );
}

/**
 * Deterministic next question from the specialty checklist.
 * Does not call the LLM for questions (avoids repetition and vague prompts).
 */
export async function nextStep(session) {
  const maxQ = Number(process.env.MAX_QUESTIONS || 10);

  if (detectUrgent(session)) {
    return {
      status: "URGENT",
      message:
        "Based on what you described, please seek urgent medical care immediately. Your clinic team will also be notified.",
      reason: "urgent_red_flag",
    };
  }

  if ((session.question_count || 0) >= maxQ) {
    return {
      status: "COMPLETE",
      message: "Thank you. We have enough information for the doctor to review.",
      reason: "max_questions_reached",
    };
  }

  return nextScriptedStep(session);
}

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    screening_id: { type: "string" },
    patient: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        age: { type: ["integer", "null"] },
        gender: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
      },
      required: ["name", "age", "gender", "phone"],
    },
    presenting_complaint: { type: ["string", "null"] },
    symptoms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          symptom: { type: "string" },
          duration: { type: ["string", "null"] },
          severity: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          details: { type: ["string", "null"] },
        },
        required: ["symptom", "duration", "severity", "location", "details"],
      },
    },
    associated_symptoms: { type: "array", items: { type: "string" } },
    medical_history: { type: "array", items: { type: "string" } },
    medications: { type: "array", items: { type: "string" } },
    allergies: { type: "array", items: { type: "string" } },
    red_flags: { type: "array", items: { type: "string" } },
    patient_concerns: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    screening_status: { type: "string", enum: ["completed", "urgent"] },
    data_quality_notes: { type: "array", items: { type: "string" } },
  },
  required: [
    "screening_id",
    "patient",
    "presenting_complaint",
    "symptoms",
    "associated_symptoms",
    "medical_history",
    "medications",
    "allergies",
    "red_flags",
    "patient_concerns",
    "summary",
    "screening_status",
    "data_quality_notes",
  ],
};

const consolidationInstructions = `
Convert the completed patient conversation into structured clinical information for an ENT or outpatient clinician.
Use ONLY facts explicitly stated by the patient or supplied in the patient record.
Never invent diagnoses, medicines, allergies, history, symptoms, severity, duration, or red flags.
Missing information must be null or [].
Do not provide diagnosis, treatment, prescription, or advice.
Preserve uncertainty in data_quality_notes.
The presenting_complaint MUST reflect the patient's stated complaint when available.
The summary MUST be a concise non-empty factual paragraph for the treating clinician.
Output only the requested JSON structure.
`.trim();

export async function consolidate(session) {
  const transcript = (session.conversation || [])
    .map((x) => `${x.role === "patient" ? "PATIENT" : "ASSISTANT"}: ${x.message}`)
    .join("\n");

  const input = `
screening_id:
${session.screening_id}

specialty:
${session.patient?.specialty || "ent"}

patient record:
${JSON.stringify(session.patient)}

conversation:
${transcript}
`.trim();

  let raw;
  try {
    raw = await sarvamChat(
      [
        { role: "system", content: consolidationInstructions },
        { role: "user", content: input },
      ],
      {
        temperature: 0.1,
        max_tokens: 2500,
        response_format: {
          type: "json_schema",
          json_schema: { name: "clinical_screening", strict: true, schema: outputSchema },
        },
      }
    );
  } catch (err) {
    console.error("consolidate sarvam error", err?.message || err);
    return buildManualSummary(session, transcript, err);
  }

  const parsed = extractJsonObject(raw);
  if (!parsed) {
    return buildManualSummary(session, transcript, new Error("invalid consolidation JSON"));
  }
  return parsed;
}

function buildManualSummary(session, transcript, err) {
  const sites = detectSite(session);
  const pt = patientText(session);
  return {
    screening_id: session.screening_id,
    patient: {
      name: session.patient?.patient_name || null,
      age: session.patient?.age ?? null,
      gender: session.patient?.gender || null,
      phone: session.patient?.phone || null,
    },
    presenting_complaint: session.patient?.complaint || sites.join(", ") || null,
    symptoms: sites.map((s) => ({
      symptom: s,
      duration: null,
      severity: null,
      location: null,
      details: pt.slice(0, 500) || null,
    })),
    associated_symptoms: [],
    medical_history: [],
    medications: [],
    allergies: [],
    red_flags: [],
    patient_concerns: [],
    summary:
      `Patient reported: ${pt.slice(0, 800) || session.patient?.complaint || "(see conversation)"}. ` +
      (err ? "Structured AI summary was unavailable; this is a transcript-based note." : ""),
    screening_status: "completed",
    data_quality_notes: ["manual_or_fallback_summary", String(err?.message || err || "").slice(0, 200)],
    conversation_transcript: transcript,
  };
}
