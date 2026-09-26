//src/ai.js
// Sarvam speaks as a specialty doctor taking a prescribe-ready history.
// Patient never fills extra forms — chat ends → structured summary.

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
    temperature: options.temperature ?? 0.4,
    reasoning_effort: options.reasoning_effort ?? null,
    max_tokens: options.max_tokens ?? 450,
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
  return !s || ["ent", "oto", "otolaryngology", "ear_nose_throat"].includes(s);
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
  return (
    String(session.patient?.complaint || "").toLowerCase() +
    " \n " +
    patientText(session)
  ).toLowerCase();
}

function detectSite(session) {
  const t = allText(session);
  const sites = [];
  if (/\bear\b|otalg|hearing|tinnitus|otitis|eardrum/.test(t)) sites.push("ear");
  if (/\bnose\b|nasal|sinus|smell|sneeze|rhinit|blocked nose|runny/.test(t)) sites.push("nose");
  if (/\bthroat\b|swallow|voice|tonsil|pharyng|sore throat/.test(t)) sites.push("throat");
  return sites;
}

/**
 * Lightweight coverage so we know when a prescribe-ready note is plausible.
 * Depth comes from the doctor persona prompt, not from a rigid checklist UI.
 */
function coverage(session) {
  const t = patientText(session);
  const sites = detectSite(session);
  return {
    sites,
    site: sites.length > 0,
    detail:
      /pain|ache|block|discharge|pus|bleed|itch|hearing|hear|ring|vertigo|dizzy|fever|cold|sore|voice|swallow|smell|sneeze|runny|congest|pressure|throb|sharp|dull/i.test(
        t
      ),
    duration:
      /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|few|several)\s*(day|days|week|weeks|month|months|hour|hours)\b|\bsince\b|\byesterday\b|\btoday\b/i.test(
        t
      ),
    severity: /mild|moderate|severe|bad| unbearable|\b[0-9]\s*\/?\s*10\b|very painful|not much pain/i.test(t),
    location: /\bleft\b|\bright\b|\bboth\b|one side|both sides|middle/.test(t),
    associated:
      /fever|discharge|hearing|vertigo|dizzy|tinnitus|ring|smell|voice|swallow|cough|cold|headache|face|swelling|node/i.test(t),
    medicine:
      /\b(no|not|none|nil|haven't|havent|never)\b.*\b(medicine|tablet|drop|syrup|antibiotic)\b|\b(medicine|tablet|drop|syrup|antibiotic|paracetamol|dolo|amox|taking|took|using)\b/i.test(
        t
      ),
    allergy: /\ballerg|\bno known|nka|\bnil\b|\bnone\b|\bno allergy|not allergic/i.test(t),
    comorbidity:
      /diabetes|sugar|pressure|hypertension|bp|asthma|thyroid|pregnant|pregnancy|breastfeed|kidney|heart|no other|nothing else|only this/i.test(
        t
      ),
  };
}

function prescribeReady(session) {
  const c = coverage(session);
  // Enough for a clinician to open the chart and choose treatment direction
  return (
    c.site &&
    c.detail &&
    c.duration &&
    (c.location || (c.sites.length === 1 && c.sites[0] === "throat")) &&
    c.severity &&
    c.medicine &&
    c.allergy
  );
}

function doctorPersona(specialty) {
  if (isEnt(specialty)) {
    return `
You are an experienced ENT specialist speaking directly with a patient in a private
pre-consultation chat for e-consultation. You are the doctor in the conversation.
You are not a chatbot, form, triage bot, or "assistant".

PURPOSE
Collect a history rich enough that another ENT doctor can open the summary and be
ready to decide on treatment and medication — without needing to re-ask the basics.
You yourself must NEVER prescribe, diagnose, or name specific drugs as advice.
You only take history.

HOW YOU SPEAK
- Like a real doctor in the room: warm, concise, one question at a time
- Brief acknowledgement of the last answer, then the next clinical question
- Simple language a patient understands
- Never say you are an AI, model, bot, or screening tool
- Never use bullet lists or "Question 1" style wording with the patient

CLINICAL DEPTH (work through these naturally; skip what is already answered)
For every ENT complaint, aim to understand:
1) Site — ear, nose, throat (or combination)
2) Exact symptoms — what they feel day to day
3) Laterality — left / right / both when relevant
4) Duration and course — how many days; same / better / worse
5) Severity — mild / moderate / severe (or how it limits sleep, work, eating)
6) Important associated features for that site, for example:
   - Ear: discharge (colour), hearing change, tinnitus, vertigo/dizziness, fever, recent cold, trauma/water/cotton buds
   - Nose: blockage vs runny, discharge colour, facial pressure, smell, sneezing, bleeding
   - Throat: pain on swallowing, fever, voice change, neck swellings, reflux symptoms
7) What they already tried — medicine names if known, drops, home remedies, and whether it helped
8) Drug allergies — name of drug and what happens if known; or clearly none
9) Ongoing illnesses / regular medicines that affect prescribing (diabetes, BP, asthma, pregnancy, breastfeeding) — ask briefly when relevant

Do NOT race through a checklist. Follow the patient's story. If they give a rich answer,
acknowledge it and go deeper on the most clinically useful missing piece.
Do NOT repeat questions already answered.
Do NOT ask vague prompts like "tell me more" without a focus.

WHEN TO FINISH
Return COMPLETE only when the history is strong enough for a prescribe-ready pre-consult note
(site, symptoms, duration, severity, key associated features, self-medication, allergies).
Closing line should thank them and say the doctor will review this before the consultation.

URGENT only for true emergencies (severe breathing difficulty, uncontrolled bleeding,
loss of consciousness, sudden severe neurological signs, facial weakness with ear infection, etc.).

Output JSON only:
{"status":"QUESTION"|"COMPLETE"|"URGENT","message":"exactly what you say to the patient","reason":"short internal note"}
`.trim();
  }

  return `
You are a clinic doctor taking a thorough pre-consultation history so another doctor
can review and decide treatment. Speak naturally, one question at a time. Never claim
to be an AI. Never prescribe. Gather: problem, details, duration, severity, location,
associated features, medicines already taken, allergies, relevant medical background.
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

function missingHints(session) {
  const c = coverage(session);
  const hints = [];
  if (!c.site) hints.push("which of ear / nose / throat");
  if (!c.detail) hints.push("main symptoms in that area");
  if (!c.location && !(c.sites.length === 1 && c.sites[0] === "throat"))
    hints.push("left / right / both");
  if (!c.duration) hints.push("how many days and whether better/worse/same");
  if (!c.severity) hints.push("how severe it is");
  if (!c.associated) hints.push("key associated features for that site (fever, discharge, hearing, etc.)");
  if (!c.medicine) hints.push("any medicine or drops already tried and if they helped");
  if (!c.allergy) hints.push("drug allergies");
  if (!c.comorbidity) hints.push("any diabetes, BP, asthma, pregnancy, or regular medicines (briefly)");
  return hints;
}

function fallbackDoctorQuestion(session) {
  const c = coverage(session);
  if (!c.site)
    return "Hello. Before your consultation, I’d like to understand what’s troubling you. Is it mainly the ear, the nose, or the throat?";
  if (!c.detail) {
    if (c.sites[0] === "ear")
      return "What’s been happening in the ear — pain, blockage, discharge, or hearing trouble?";
    if (c.sites[0] === "nose") return "What’s been happening with the nose?";
    if (c.sites[0] === "throat") return "What’s been happening with the throat?";
    return "What exactly have you been feeling?";
  }
  if (!c.location && !(c.sites.length === 1 && c.sites[0] === "throat"))
    return "Is it on the left, the right, or both sides?";
  if (!c.duration) return "How many days has this been going on, and is it getting better or worse?";
  if (!c.severity) return "How bad is it right now — mild, moderate, or severe?";
  if (!c.associated) {
    if (c.sites.includes("ear"))
      return "Any fever, discharge from the ear, or change in hearing with this?";
    if (c.sites.includes("nose"))
      return "Any fever, facial pressure, or change in smell?";
    if (c.sites.includes("throat"))
      return "Any fever, or pain when you swallow?";
    return "Have you noticed any fever or other symptoms with this?";
  }
  if (!c.medicine)
    return "Have you already taken any medicine or used drops for this? If yes, what did you take, and did it help?";
  if (!c.allergy) return "Any allergy to medicines that we should know about?";
  if (!c.comorbidity)
    return "Do you have any ongoing illness like diabetes or blood pressure, or take any regular medicines?";
  return null;
}

function looksLikeRepeat(session, message) {
  const next = String(message || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!next) return true;
  for (const p of assistantQuestions(session)) {
    const norm = p.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (!norm) continue;
    if (norm === next) return true;
    const a = new Set(norm.split(" ").filter((w) => w.length > 3));
    const b = next.split(" ").filter((w) => w.length > 3);
    if (b.length >= 5) {
      const hit = b.filter((w) => a.has(w)).length;
      if (hit / b.length >= 0.8) return true;
    }
  }
  return false;
}

export async function nextStep(session) {
  const specialty = session.patient?.specialty || "ent";
  const maxQ = Number(process.env.MAX_QUESTIONS || 14);
  const minQ = Number(process.env.MIN_QUESTIONS || 6);
  const qCount = session.question_count || 0;

  const transcript = (session.conversation || [])
    .map((x) => `${x.role === "patient" ? "Patient" : "Doctor"}: ${x.message}`)
    .join("\n");

  const hints = missingHints(session);

  const input = `
Patient:
- Name: ${session.patient?.patient_name || "Patient"}
- Age: ${session.patient?.age ?? "unknown"}
- Gender: ${session.patient?.gender || "unknown"}
- Specialty context: ${normalizeSpecialty(specialty) || "ent"}
- Registration note: ${session.patient?.complaint || "(none)"}

Conversation so far:
${transcript || "(Patient just opened the chat. Greet briefly as the doctor and begin a proper history.)"}

Doctor turns so far: ${qCount}
Minimum turns before you may finish: ${minQ}
Maximum turns: ${maxQ}

Still thin or missing for a prescribe-ready note (do not re-ask what is already clear):
${hints.length ? hints.map((h) => "- " + h).join("\n") : "- Core history looks adequate — thank the patient and finish."}

Your next turn as the doctor only.
`.trim();

  let result;
  try {
    const raw = await sarvamChat(
      [
        { role: "system", content: doctorPersona(specialty) },
        { role: "user", content: input },
      ],
      {
        temperature: 0.45,
        max_tokens: 260,
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
    console.error("nextStep sarvam error", err?.message || err);
    const fb = fallbackDoctorQuestion(session);
    if (!fb) {
      return {
        status: "COMPLETE",
        message:
          "Thank you for going through this with me. I’ve noted the details for the doctor to review before your consultation.",
        reason: "fallback_complete",
      };
    }
    return { status: "QUESTION", message: fb, reason: "model_unavailable_fallback" };
  }

  result.status = String(result.status || "QUESTION").toUpperCase();
  if (!["QUESTION", "COMPLETE", "URGENT"].includes(result.status)) result.status = "QUESTION";
  result.message = typeof result.message === "string" ? result.message.trim() : "";
  result.reason = typeof result.reason === "string" ? result.reason : "";

  result.message = result.message
    .replace(/\b(as an AI|I'm an AI|I am an AI|language model|chatbot|screening bot|AI assistant)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Hold the model back from finishing too early
  if (result.status === "COMPLETE" && qCount < minQ && !prescribeReady(session)) {
    result.status = "QUESTION";
    const fb = fallbackDoctorQuestion(session);
    if (fb && (!result.message || !/\?/.test(result.message) || looksLikeRepeat(session, result.message))) {
      result.message = fb;
    }
    result.reason = "history_still_thin";
  }

  if (result.status === "COMPLETE" && /\?\s*$/.test(result.message)) {
    result.status = "QUESTION";
    result.reason = result.reason || "follow_up_question";
  }

  // Finish when ready or at cap
  if (
    result.status === "QUESTION" &&
    ((prescribeReady(session) && qCount >= minQ) || qCount >= maxQ)
  ) {
    result.status = "COMPLETE";
    result.message =
      result.message && !/\?\s*$/.test(result.message)
        ? result.message
        : "Thank you for going through this carefully with me. I’ve noted everything so the doctor can review it before your consultation.";
    result.reason = qCount >= maxQ ? "max_questions" : "prescribe_ready";
  }

  if (result.status === "QUESTION" && looksLikeRepeat(session, result.message)) {
    const fb = fallbackDoctorQuestion(session);
    if (fb && !looksLikeRepeat(session, fb)) {
      result.message = fb;
      result.reason = "deduped_fallback";
    } else if (qCount >= minQ) {
      result.status = "COMPLETE";
      result.message =
        "Thank you. That’s enough for the doctor to review before seeing you.";
      result.reason = "dedupe_complete";
    }
  }

  if (result.status === "QUESTION" && !result.message) {
    result.message =
      fallbackDoctorQuestion(session) ||
      "Can you help me understand what troubles you the most right now?";
    result.reason = "empty_message";
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
You are preparing a concise pre-consultation clinical note for an ENT doctor.
Use ONLY facts the patient stated or that appear in the patient record.
Never invent diagnoses, drugs, allergies, or findings.
Missing items: null or [].
Do not prescribe or advise.

The summary MUST be a dense, usable clinical paragraph a doctor can skim before
prescribing — include site, laterality, duration, severity, key associated features,
self-medication tried, allergies, and relevant background when stated.

Output only the requested JSON.
`.trim();

export async function consolidate(session) {
  const transcript = (session.conversation || [])
    .map((x) => `${x.role === "patient" ? "Patient" : "Doctor"}: ${x.message}`)
    .join("\n");

  const input = `
screening_id: ${session.screening_id}
specialty: ${session.patient?.specialty || "ent"}
patient: ${JSON.stringify(session.patient)}
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
    console.error("consolidate error", err?.message || err);
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
      details: pt.slice(0, 600) || null,
    })),
    associated_symptoms: [],
    medical_history: [],
    medications: [],
    allergies: [],
    red_flags: [],
    patient_concerns: [],
    summary: pt.slice(0, 1200) || session.patient?.complaint || "See conversation transcript.",
    screening_status: "completed",
    data_quality_notes: ["fallback_summary"],
    conversation_transcript: transcript,
  };
}
