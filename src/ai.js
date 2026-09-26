//src/ai.js

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

/** Extract first JSON object from model text (handles truncated / markdown wrappers). */
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
  // Try progressively shorter tails if truncated
  for (let end = cleaned.lastIndexOf("}"); end > start; end = cleaned.lastIndexOf("}", end - 1)) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      /* try again */
    }
  }
  // Attempt to close truncated JSON for common nextStep shape
  const partial = cleaned.slice(start);
  const statusMatch = partial.match(/"status"\s*:\s*"(QUESTION|COMPLETE|URGENT)"/i);
  const messageMatch = partial.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (statusMatch) {
    return {
      status: statusMatch[1].toUpperCase(),
      message: messageMatch ? messageMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ") : "",
      reason: "recovered_from_truncated_json",
    };
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

const SPECIALTY_GUIDANCE = {
  ent: `
SPECIALTY FOCUS: ENT (Ear, Nose, Throat) only.
Stay strictly within ENT. Do not ask about unrelated systems (chest pain workup, abdominal pain, limb injuries) unless the patient brings them up as associated to an ENT complaint.

For ear complaints prioritize in order:
1) Which ear (left / right / both)
2) Onset and duration (hours / days / weeks)
3) Pain severity (mild / moderate / severe) and character (sharp, dull, throbbing)
4) Hearing change, blockage, tinnitus, discharge (colour/smell), itching
5) Fever, recent cold/URI, water exposure, trauma, cotton-bud use
6) Prior ear problems, current ear drops/medicines, allergies

For nose/sinus: laterality, congestion vs runny, colour of discharge, facial pain/pressure, smell loss, sneezing, allergy history, duration.

For throat: pain on swallowing, voice change, fever, nodes, reflux symptoms, duration, hydration.

Ask ONE concrete question that a busy ENT doctor would use before consultation. Prefer closed or short-answer forms when possible (e.g. "Which ear is affected — left, right, or both?").
`.trim(),

  general: `
SPECIALTY FOCUS: general outpatient.
Prioritize onset, duration, location, severity, associated symptoms, medicines, allergies, and red flags relevant to the stated complaint.
Ask ONE concrete, clinically useful question at a time.
`.trim(),
};

function specialtyBlock(specialty) {
  const key = normalizeSpecialty(specialty);
  if (key === "ent" || key === "oto" || key === "otolaryngology" || key === "ear_nose_throat") {
    return SPECIALTY_GUIDANCE.ent;
  }
  return SPECIALTY_GUIDANCE.general + (key ? `\nClinic specialty code: ${key}.` : "");
}

/* Fallback ENT/general question bank when model fails or finishes too early */
function fallbackQuestion(session) {
  const specialty = normalizeSpecialty(session.patient?.specialty);
  const transcript = (session.conversation || [])
    .map((x) => x.message)
    .join(" ")
    .toLowerCase();
  const complaint = String(session.patient?.complaint || "").toLowerCase();
  const isEar = /ear|otalg|hearing|tinnitus|otitis/.test(complaint + " " + transcript);
  const isNose = /nose|nasal|sinus|smell|sneeze|rhinit/.test(complaint + " " + transcript);
  const isThroat = /throat|swallow|voice|tonsil|pharyng/.test(complaint + " " + transcript);

  const asked = (re) => re.test(transcript);

  if (specialty === "ent" || isEar || isNose || isThroat) {
    if (isEar || (!isNose && !isThroat)) {
      if (!asked(/left|right|both|which ear/)) {
        return "Which ear is affected — left, right, or both?";
      }
      if (!asked(/day|week|hour|since|ago|duration|how long|started/)) {
        return "When did this ear problem start, and has it been continuous or on-and-off?";
      }
      if (!asked(/mild|moderate|severe|severity|scale|pain level/)) {
        return "How severe is the ear pain right now — mild, moderate, or severe?";
      }
      if (!asked(/hearing|hear|block|fullness|deaf/)) {
        return "Has your hearing reduced, or does the ear feel blocked?";
      }
      if (!asked(/discharge|pus|fluid|drain|wet|smell/)) {
        return "Is there any discharge from the ear? If yes, what colour is it?";
      }
      if (!asked(/fever|cold|flu|uri|cough|runny/)) {
        return "Have you had fever or a recent cold or cough with this?";
      }
      if (!asked(/drop|medicine|tablet|antibiotic|taking/)) {
        return "Are you using any ear drops or medicines for this right now?";
      }
      if (!asked(/allerg/)) {
        return "Do you have any medicine or other allergies?";
      }
    }
    if (isNose) {
      if (!asked(/day|week|hour|how long|started|duration/))
        return "How many days has the nose or sinus problem been present?";
      if (!asked(/both|one side|left|right/))
        return "Is the blockage or discharge on one side or both sides?";
      if (!asked(/colour|color|yellow|green|clear|blood/))
        return "What colour is the nasal discharge, if any?";
      if (!asked(/fever|face|pressure|smell/))
        return "Do you have facial pressure, reduced smell, or fever?";
    }
    if (isThroat) {
      if (!asked(/day|week|how long|started/))
        return "How many days have you had the throat problem?";
      if (!asked(/swallow|pain/))
        return "Is it painful to swallow solids, liquids, or both?";
      if (!asked(/fever|voice|node|neck/))
        return "Do you have fever, voice change, or swollen glands in the neck?";
    }
  }

  if (!asked(/day|week|hour|how long|started|duration/))
    return "How long have you had this problem?";
  if (!asked(/mild|moderate|severe|severity/))
    return "How severe is it right now — mild, moderate, or severe?";
  if (!asked(/other symptom|also have|along with/))
    return "Have you noticed any other symptoms along with this?";
  if (!asked(/medicine|tablet|taking/))
    return "Are you currently taking any medicines for this or any other condition?";
  if (!asked(/allerg/))
    return "Do you have any known allergies to medicines?";
  return "Is there anything else important you want the doctor to know before the consultation?";
}

const conversationInstructions = `
You are a clinical information-collection assistant in a private browser chat
before an outpatient consultation.

Your job is ONLY to collect and clarify information for the treating doctor.

You do NOT:
- diagnose
- prescribe
- recommend medicines or treatment
- make clinical decisions

Ask exactly ONE short, plain-language question at a time.
Prefer specific questions a specialist can act on (laterality, duration in days,
severity category, presence/absence of key associated features).
Avoid vague questions like "can you tell me more?" or "how are you feeling?".

Adapt to what the patient already said. Do not repeat questions already answered.
Do not invent facts. If the patient does not know, accept that and move on.

If enough useful specialty-relevant detail is collected, return COMPLETE.
Only use URGENT for clear emergencies (severe breathing difficulty, loss of
consciousness, uncontrolled bleeding, sudden severe neurological symptoms).
Ordinary ear pain, reduced hearing, fever, headache, or dizziness alone are NOT URGENT.

Output JSON only with keys: status, message, reason.
`.trim();

const nextSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["QUESTION", "COMPLETE", "URGENT"] },
    message: { type: "string" },
    reason: { type: "string" },
  },
  required: ["status", "message", "reason"],
};

export async function nextStep(session) {
  const transcript = (session.conversation || [])
    .map((x) => `${x.role === "patient" ? "PATIENT" : "ASSISTANT"}: ${x.message}`)
    .join("\n");

  const specialty = session.patient?.specialty || "";
  const maxQ = Number(process.env.MAX_QUESTIONS || 12);
  const minQ = Number(process.env.MIN_QUESTIONS || 5);

  const input = `
${specialtyBlock(specialty)}

Patient record:
${JSON.stringify(session.patient)}

Conversation so far:
${transcript || "(none)"}

Questions already asked by assistant: ${session.question_count || 0}
Minimum useful questions before COMPLETE: ${minQ}
Maximum questions: ${maxQ}

Return the next single question, or COMPLETE if enough specialty-relevant detail is present.
`.trim();

  let raw;
  try {
    raw = await sarvamChat(
      [
        { role: "system", content: conversationInstructions + "\n\n" + specialtyBlock(specialty) },
        { role: "user", content: input },
      ],
      {
        temperature: 0.25,
        reasoning_effort: null,
        max_tokens: 280,
        response_format: {
          type: "json_schema",
          json_schema: { name: "next_step", strict: true, schema: nextSchema },
        },
      }
    );
  } catch (err) {
    // Model overloaded / network — never hard-fail the patient chat
    console.error("nextStep sarvam error, using fallback question", err?.message || err);
    return {
      status: "QUESTION",
      message: fallbackQuestion(session),
      reason: "model_unavailable_fallback",
    };
  }

  let result = extractJsonObject(raw);
  if (!result || typeof result !== "object") {
    console.error("nextStep invalid JSON, fallback", String(raw).slice(0, 400));
    return {
      status: "QUESTION",
      message: fallbackQuestion(session),
      reason: "invalid_json_fallback",
    };
  }

  result.status = String(result.status || "QUESTION").toUpperCase();
  if (!["QUESTION", "COMPLETE", "URGENT"].includes(result.status)) result.status = "QUESTION";
  result.message = typeof result.message === "string" ? result.message.trim() : "";
  result.reason = typeof result.reason === "string" ? result.reason : "";

  // Enforce minimum questions (except true URGENT)
  if (result.status === "COMPLETE" && (session.question_count || 0) < minQ) {
    result.status = "QUESTION";
    if (!/\?\s*$/.test(result.message)) {
      result.message = fallbackQuestion(session);
      result.reason = "minimum_questions_fallback";
    } else {
      result.reason = result.reason || "minimum_questions_not_reached";
    }
  } else if (result.status === "COMPLETE" && /\?\s*$/.test(result.message)) {
    result.status = "QUESTION";
    result.reason = result.reason || "follow_up_question";
  }

  if (result.status === "QUESTION" && !result.message) {
    result.message = fallbackQuestion(session);
    result.reason = "empty_message_fallback";
  }

  // Soft-cap: if at max questions, force complete path upstream
  if ((session.question_count || 0) >= maxQ && result.status === "QUESTION") {
    result.status = "COMPLETE";
    result.message = result.message || "Thank you. We have enough information for the doctor to review.";
    result.reason = "max_questions_reached";
  }

  return result;
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
Convert the completed patient conversation into structured clinical information.
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
${session.patient?.specialty || ""}

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
    // Minimal structured fallback so the doctor still sees something
    return {
      screening_id: session.screening_id,
      patient: {
        name: session.patient?.patient_name || null,
        age: session.patient?.age ?? null,
        gender: session.patient?.gender || null,
        phone: session.patient?.phone || null,
      },
      presenting_complaint: session.patient?.complaint || null,
      symptoms: [],
      associated_symptoms: [],
      medical_history: [],
      medications: [],
      allergies: [],
      red_flags: [],
      patient_concerns: [],
      summary:
        "Automated consolidation was temporarily unavailable. Please review the raw conversation transcript with the patient.",
      screening_status: "completed",
      data_quality_notes: ["consolidation_model_unavailable", String(err?.message || err).slice(0, 200)],
      conversation_transcript: transcript,
    };
  }

  const parsed = extractJsonObject(raw);
  if (!parsed) {
    throw new Error(`Sarvam returned invalid JSON for consolidation: ${String(raw).slice(0, 500)}`);
  }
  return parsed;
}
