//src/ai.js
//
// Conversation: Sarvam speaks as a specialty doctor taking history.
// Fallback: short clinical script if the model is down.
// Consolidation: structured summary for the treating clinician.

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
  const partial = cleaned.slice(start);
  const statusMatch = partial.match(/"status"\s*:\s*"(QUESTION|COMPLETE|URGENT)"/i);
  const messageMatch = partial.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (statusMatch) {
    return {
      status: statusMatch[1].toUpperCase(),
      message: messageMatch
        ? messageMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ")
        : "",
      reason: "recovered_from_truncated_json",
    };
  }
  return null;
}

async function sarvamChat(messages, options = {}, attempt = 1) {
  const body = {
    model: SARVAM_MODEL,
    messages,
    temperature: options.temperature ?? 0.35,
    reasoning_effort: options.reasoning_effort ?? null,
    max_tokens: options.max_tokens ?? 400,
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
      await sleep(900 * attempt);
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

function isEnt(specialty) {
  const s = normalizeSpecialty(specialty);
  return (
    !s ||
    s === "ent" ||
    s === "oto" ||
    s === "otolaryngology" ||
    s === "ear_nose_throat"
  );
}

function patientText(session) {
  return (session.conversation || [])
    .filter((x) => x.role === "patient")
    .map((x) => x.message)
    .join(" \n ")
    .toLowerCase();
}

function assistantQuestions(session) {
  return (session.conversation || [])
    .filter((x) => x.role === "assistant")
    .map((x) => String(x.message || "").toLowerCase());
}

function allText(session) {
  const complaint = String(session.patient?.complaint || "").toLowerCase();
  return (complaint + " \n " + patientText(session)).toLowerCase();
}

function detectSite(session) {
  const t = allText(session);
  const sites = [];
  if (/\bear\b|otalg|hearing|tinnitus|otitis|eardrum/.test(t)) sites.push("ear");
  if (/\bnose\b|nasal|sinus|smell|sneeze|rhinit|blocked nose|runny/.test(t)) sites.push("nose");
  if (/\bthroat\b|swallow|voice|tonsil|pharyng|sore throat/.test(t)) sites.push("throat");
  return sites;
}

function coverage(session) {
  const t = patientText(session);
  const sites = detectSite(session);
  return {
    site: sites.length > 0,
    sites,
    detail: /pain|ache|block|discharge|pus|bleed|itch|hearing|hear|ring|fever|cold|sore|voice|swallow|smell|sneeze|runny|congest|pressure|mild|moderate|severe/i.test(
      t
    ),
    duration:
      /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|few|several)\s*(day|days|week|weeks|month|months|hour|hours)\b|\bsince\b|\byesterday\b|\btoday\b|\blast\s+(night|week|month)/i.test(
        t
      ),
    location: /\bleft\b|\bright\b|\bboth\b|one side|both sides|middle/.test(t),
    medicine:
      /\b(no|not|none|nil|haven't|havent|never)\b.*\b(medicine|tablet|drop|syrup|antibiotic)\b|\b(medicine|tablet|drop|syrup|antibiotic|taking|took|using)\b/i.test(
        t
      ),
    allergy: /\ballerg|\bno known|nka|\bnil\b|\bnone\b|\bno allergy|not allergic/i.test(t),
  };
}

function doctorPersona(specialty) {
  if (isEnt(specialty)) {
    return `
You are an ENT (ear, nose, throat) doctor speaking directly with a patient
before clinic consultation. You are not a chatbot, not a form, and not a triage bot.

Speak the way a real doctor speaks in the consulting room:
- Warm, calm, clear English (or simple words a patient understands)
- Short turns — usually one question, sometimes a brief acknowledgement + one question
- Natural phrases like "I see", "Alright", "Thank you", "Can you tell me…"
- Never say you are an AI, assistant, bot, or screening tool
- Never diagnose, prescribe, or give treatment advice

Your only job is to take a focused ENT history so the treating doctor is prepared.

Stay strictly within ear, nose, and throat. Do not wander into unrelated systems
unless the patient brings them up in relation to the ENT complaint.

Clinical goals — gather these, in a natural order, without sounding like a checklist:
1) What is the problem — ear, nose, or throat (or more than one)
2) What is happening there (pain, blockage, discharge, hearing change, etc.)
3) How long — days / weeks
4) Where — left, right, both, or which area
5) Any medicine or drops already taken
6) Any allergies

Rules for good questions:
- Ask only ONE question at a time
- Build on what the patient just said; do not ignore their words
- Never repeat a question already answered
- Never ask the same thing in different words if they already answered
- Prefer concrete, useful clinical detail over vague prompts
- Do not ask "tell me more" or "how are you feeling" without a clear focus
- If they say they don't know, accept it and move on

When you have enough for a useful pre-consult note (the goals above are largely covered),
stop asking and return COMPLETE with a short thank-you line.

Use URGENT only for true emergencies (severe breathing difficulty, loss of consciousness,
uncontrolled bleeding, sudden severe neurological symptoms). Ordinary ear pain, blocked
nose, sore throat, fever, or reduced hearing alone are NOT urgent.

Output JSON only:
{ "status": "QUESTION" | "COMPLETE" | "URGENT", "message": "...", "reason": "..." }

In QUESTION, "message" is exactly what you say to the patient (plain speech, no labels).
`.trim();
  }

  return `
You are a clinic doctor speaking directly with a patient before consultation.
Speak naturally, warmly, one question at a time. You are not an AI bot or a form.
Do not diagnose or prescribe. Collect: main problem, what is happening, how long,
where, medicines already taken, allergies. Stay relevant to the patient's complaint.
Output JSON only with status, message, reason.
`.trim();
}

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

/** Emergency scripted fallback if Sarvam is unavailable — still doctor-like tone. */
function fallbackDoctorQuestion(session) {
  const c = coverage(session);
  if (!c.site) {
    return "Hello. Before you see the doctor, can you tell me — is the problem mainly with your ear, nose, or throat?";
  }
  if (!c.detail) {
    if (c.sites.includes("ear") && c.sites.length === 1) {
      return "Alright. What’s going on in the ear — pain, blockage, discharge, or trouble hearing?";
    }
    if (c.sites.includes("nose") && c.sites.length === 1) {
      return "Alright. What’s been happening with the nose?";
    }
    if (c.sites.includes("throat") && c.sites.length === 1) {
      return "Alright. What’s been happening with the throat?";
    }
    return "Okay. What exactly have you been feeling?";
  }
  if (!c.duration) return "I see. How many days has this been going on?";
  if (!c.location) {
    if (c.sites.includes("ear") && c.sites.length === 1) {
      return "Is it the left ear, the right, or both?";
    }
    return "Where do you feel it most — left, right, or both sides?";
  }
  if (!c.medicine) {
    return "Have you taken any medicine or used any drops for this already?";
  }
  if (!c.allergy) {
    return "Do you have any medicine allergies we should know about?";
  }
  return null; // means complete
}

function looksLikeRepeat(session, message) {
  const next = String(message || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!next) return true;
  const prev = assistantQuestions(session);
  for (const p of prev) {
    const norm = p.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (!norm) continue;
    if (norm === next) return true;
    // High overlap on content words
    const a = new Set(norm.split(" ").filter((w) => w.length > 3));
    const b = next.split(" ").filter((w) => w.length > 3);
    if (b.length >= 4) {
      const hit = b.filter((w) => a.has(w)).length;
      if (hit / b.length >= 0.75) return true;
    }
  }
  return false;
}

function goalsMet(session) {
  const c = coverage(session);
  // Core history a specialty doctor would want before consult
  return c.site && c.detail && c.duration && (c.location || c.sites.includes("throat")) && c.medicine && c.allergy;
}

export async function nextStep(session) {
  const specialty = session.patient?.specialty || "ent";
  const maxQ = Number(process.env.MAX_QUESTIONS || 10);
  const minQ = Number(process.env.MIN_QUESTIONS || 4);
  const qCount = session.question_count || 0;

  const transcript = (session.conversation || [])
    .map((x) => `${x.role === "patient" ? "Patient" : "Doctor"}: ${x.message}`)
    .join("\n");

  const c = coverage(session);
  const stillNeeded = [];
  if (!c.site) stillNeeded.push("which area: ear / nose / throat");
  if (!c.detail) stillNeeded.push("what is happening in that area");
  if (!c.duration) stillNeeded.push("how many days");
  if (!c.location && !(c.sites.length === 1 && c.sites[0] === "throat"))
    stillNeeded.push("left / right / both or exact place");
  if (!c.medicine) stillNeeded.push("any medicine already taken");
  if (!c.allergy) stillNeeded.push("any allergies");

  if (qCount >= maxQ || (goalsMet(session) && qCount >= minQ)) {
    // Prefer model goodbye; if we skip model, use natural close
  }

  const input = `
Patient record:
- Name: ${session.patient?.patient_name || "Patient"}
- Age: ${session.patient?.age ?? "unknown"}
- Gender: ${session.patient?.gender || "unknown"}
- Clinic specialty: ${normalizeSpecialty(specialty) || "ent"}
- Registration note: ${session.patient?.complaint || "(none)"}

Conversation so far:
${transcript || "(The patient has just opened the chat. Greet them briefly and begin the history.)"}

Doctor questions already asked: ${qCount}
Minimum useful exchanges before finishing: ${minQ}
Maximum questions: ${maxQ}

History still missing (do not ask about items already answered):
${stillNeeded.length ? stillNeeded.map((x) => "- " + x).join("\n") : "- Core history appears complete — thank the patient and finish."}

Respond as the doctor for the next turn only.
`.trim();

  let result;
  try {
    const raw = await sarvamChat(
      [
        { role: "system", content: doctorPersona(specialty) },
        { role: "user", content: input },
      ],
      {
        temperature: 0.4,
        max_tokens: 220,
        response_format: {
          type: "json_schema",
          json_schema: { name: "next_step", strict: true, schema: nextSchema },
        },
      }
    );
    result = extractJsonObject(raw);
    if (!result || typeof result !== "object") {
      throw new Error("invalid nextStep JSON: " + String(raw).slice(0, 300));
    }
  } catch (err) {
    console.error("nextStep sarvam error, doctor fallback", err?.message || err);
    const fb = fallbackDoctorQuestion(session);
    if (!fb) {
      return {
        status: "COMPLETE",
        message:
          "Thank you for talking through this with me. I’ve noted it for the doctor before your consultation.",
        reason: "fallback_complete",
      };
    }
    return { status: "QUESTION", message: fb, reason: "model_unavailable_fallback" };
  }

  result.status = String(result.status || "QUESTION").toUpperCase();
  if (!["QUESTION", "COMPLETE", "URGENT"].includes(result.status)) result.status = "QUESTION";
  result.message = typeof result.message === "string" ? result.message.trim() : "";
  result.reason = typeof result.reason === "string" ? result.reason : "";

  // Strip bot-like self-references if the model slips
  result.message = result.message
    .replace(/\b(as an AI|I'm an AI|I am an AI|language model|chatbot|screening bot)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Too early to finish
  if (result.status === "COMPLETE" && qCount < minQ && !goalsMet(session)) {
    result.status = "QUESTION";
    if (!result.message || !/\?/.test(result.message) || looksLikeRepeat(session, result.message)) {
      result.message = fallbackDoctorQuestion(session) || result.message;
    }
    result.reason = "minimum_history_not_reached";
  }

  // COMPLETE with a question mark → treat as question
  if (result.status === "COMPLETE" && /\?\s*$/.test(result.message)) {
    result.status = "QUESTION";
    result.reason = result.reason || "follow_up_question";
  }

  // Goals met or max questions → finish
  if (result.status === "QUESTION" && (goalsMet(session) && qCount >= minQ || qCount >= maxQ)) {
    result.status = "COMPLETE";
    result.message =
      result.message && !/\?\s*$/.test(result.message)
        ? result.message
        : "Thank you for talking through this with me. I’ve noted everything for the doctor before your consultation.";
    result.reason = qCount >= maxQ ? "max_questions_reached" : "goals_met";
  }

  // Avoid repeating earlier questions
  if (result.status === "QUESTION" && looksLikeRepeat(session, result.message)) {
    const fb = fallbackDoctorQuestion(session);
    if (fb && !looksLikeRepeat(session, fb)) {
      result.message = fb;
      result.reason = "deduped_to_fallback";
    } else if (goalsMet(session) || qCount >= minQ) {
      result.status = "COMPLETE";
      result.message =
        "Thank you. That’s helpful — I’ve noted it for the doctor.";
      result.reason = "dedupe_complete";
    }
  }

  if (result.status === "QUESTION" && !result.message) {
    result.message =
      fallbackDoctorQuestion(session) ||
      "Can you tell me a little more about what you’ve been feeling?";
    result.reason = "empty_message_fallback";
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
Convert the completed doctor–patient conversation into structured clinical information.
Use ONLY facts explicitly stated by the patient or in the patient record.
Never invent diagnoses, medicines, allergies, history, symptoms, severity, or duration.
Missing information must be null or [].
Do not provide diagnosis, treatment, or advice.
The summary is a concise factual pre-consult note for the treating clinician.
Output only the requested JSON.
`.trim();

export async function consolidate(session) {
  const transcript = (session.conversation || [])
    .map((x) => `${x.role === "patient" ? "Patient" : "Doctor"}: ${x.message}`)
    .join("\n");

  const input = `
screening_id: ${session.screening_id}
specialty: ${session.patient?.specialty || "ent"}
patient record: ${JSON.stringify(session.patient)}
conversation:
${transcript}
`.trim();

  try {
    const raw = await sarvamChat(
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
    const parsed = extractJsonObject(raw);
    if (parsed) return parsed;
  } catch (err) {
    console.error("consolidate sarvam error", err?.message || err);
  }

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
    summary: `Patient reported: ${pt.slice(0, 800) || session.patient?.complaint || "(see conversation)"}.`,
    screening_status: "completed",
    data_quality_notes: ["fallback_summary"],
    conversation_transcript: transcript,
  };
}
