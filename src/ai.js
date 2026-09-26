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
    contract_version: { type: "string" },
    screening_id: { type: "string" },
    screening: {
      type: "object", additionalProperties: false,
      properties: {
        screening_id: { type: "string" },
        status: { type: "string", enum: ["not_started", "in_progress", "completed", "failed", "abandoned"] },
        started_at: { type: ["string", "null"] },
        completed_at: { type: ["string", "null"] }
      },
      required: ["screening_id", "status", "started_at", "completed_at"]
    },
    patient: {
      type: "object", additionalProperties: false,
      properties: {
        patient_id: { type: ["string", "null"] }, name: { type: ["string", "null"] },
        age: { type: ["integer", "null"] }, age_unit: { type: ["string", "null"] },
        gender: { type: ["string", "null"] }, phone_last10: { type: ["string", "null"] },
        date: { type: ["string", "null"] }
      },
      required: ["patient_id", "name", "age", "age_unit", "gender", "phone_last10", "date"]
    },
    vitals: {
      type: "object", additionalProperties: false,
      properties: {
        bp: { type: ["object", "null"] }, pulse: { type: ["object", "null"] },
        temperature: { type: ["object", "null"] }, spo2: { type: ["object", "null"] },
        weight: { type: ["object", "null"] }, respiratory_rate: { type: ["object", "null"] },
        rbs: { type: ["object", "null"] }
      },
      required: ["bp", "pulse", "temperature", "spo2", "weight", "respiratory_rate", "rbs"]
    },
    complaints: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          laterality: { type: "string", enum: ["left", "right", "bilateral", "midline", "not_applicable", "unknown"] },
          duration: {
            type: "object", additionalProperties: false,
            properties: {
              value: { type: ["number", "null"] },
              unit: { type: "string", enum: ["hours", "days", "weeks", "months", "years", "unknown"] }
            },
            required: ["value", "unit"]
          },
          course: { type: "string", enum: ["improving", "worsening", "stable", "intermittent", "unknown"] },
          severity: { type: "string", enum: ["mild", "moderate", "severe", "unknown"] },
          associated_symptoms: { type: "array", items: { type: "string" } },
          qualifiers: { type: "array", items: { type: "string" } },
          impact: { type: "string" },
          treatment_tried: {
            type: "object", additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["none", "reported", "unknown"] },
              items: { type: "array", items: { type: "string" } }
            },
            required: ["status", "items"]
          },
          priority: { type: "string", enum: ["chief", "secondary", "unknown"] },
          source: { type: "string", enum: ["patient_reported", "desk", "screening", "doctor", "system", "unknown"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["id", "text", "laterality", "duration", "course", "severity", "associated_symptoms", "qualifiers", "impact", "treatment_tried", "priority", "source", "confidence"]
      }
    },
    allergies: {
      type: "object", additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["reported", "none_reported", "unknown"] },
        items: { type: "array", items: { type: "string" } }
      },
      required: ["status", "items"]
    },
    medical_history: {
      type: "object", additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["reported", "none_reported", "unknown"] },
        items: { type: "array", items: { type: "string" } }
      },
      required: ["status", "items"]
    },
    current_medications: {
      type: "object", additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["reported", "none_reported", "unknown"] },
        items: { type: "array", items: { type: "string" } }
      },
      required: ["status", "items"]
    },
    red_flags: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          id: { type: "string" }, text: { type: "string" },
          source: { type: "string", enum: ["patient_reported", "desk", "screening", "doctor", "system", "unknown"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["id", "text", "source", "confidence"]
      }
    },
    provenance: {
      type: "object", additionalProperties: false,
      properties: {
        complaints: { type: "string" },
        allergies: { type: "string" },
        medical_history: { type: "string" },
        current_medications: { type: "string" },
        vitals: { type: "object" }
      },
      required: ["complaints", "allergies", "medical_history", "current_medications", "vitals"]
    },
    completion: {
      type: "object", additionalProperties: false,
      properties: {
        patient_details: { type: "boolean" }, vitals: { type: "boolean" }, complaints: { type: "boolean" },
        allergies: { type: "boolean" }, medical_history: { type: "boolean" }, current_medications: { type: "boolean" },
        screening_complete: { type: "boolean" }
      },
      required: ["patient_details", "vitals", "complaints", "allergies", "medical_history", "current_medications", "screening_complete"]
    },
    summary: { type: "string" },
    screening_status: { type: "string", enum: ["completed", "urgent"] },
    patient_approved: { type: "boolean" },
    submitted_at: { type: ["string", "null"] },
    data_quality_notes: { type: "array", items: { type: "string" } }
  },
  required: ["contract_version", "screening_id", "screening", "patient", "vitals", "complaints", "allergies", "medical_history", "current_medications", "red_flags", "provenance", "completion", "summary", "screening_status", "patient_approved", "submitted_at", "data_quality_notes"]
};

const consolidationInstructions = `
You are the clinical-information consolidation component of AI Clinical Screening.

Convert the patient conversation into Contract Version 1.1 for MediLoop Clinical AI.

The most important rule: NEVER return a confusing sequence of raw patient answers.
Every answer must be attached to the clinical field/question it answers.

You are NOT diagnosing the patient.
You are NOT prescribing medication.
You are NOT recommending treatment.
You are NOT deciding what the doctor should do.
You are NOT ranking symptoms by medical severity.

Use ONLY information explicitly stated by the patient or supplied in the session.
Never invent a diagnosis, medication, allergy, vital sign, duration, laterality, symptom, severity, course, medical history, or treatment.

COMPLAINTS
- Each distinct patient-reported problem becomes one complaints[] item.
- text is the named problem in concise clinical shorthand, e.g. "ear blockage", not a raw answer such as "blocked".
- laterality is the answer to the side question: left / right / bilateral / midline / not_applicable / unknown.
- duration is the answer to the "how long" question. Use numeric values only when explicitly supported.
- course is the answer to whether it is improving, worsening, stable or intermittent. Do not infer worsening from words elsewhere.
- severity is the answer to the severity question. A word such as "severe" may be used only when the patient explicitly reports severity.
- associated_symptoms contains symptoms explicitly linked to the complaint, e.g. dizziness, discharge.
- qualifiers contains useful details that do not fit the other fields, such as "spinning sensation".
- impact records an explicit functional effect, e.g. "unable to sleep". Do not infer impact.
- treatment_tried records the answer to "what have you tried?". If the patient says "not tried", use status "none" and items [].
- Mark one complaint "chief" only when clearly the main reason for the conversation; this is conversational prominence, NOT medical severity.
- source for patient symptoms is "patient_reported".
- confidence describes extraction confidence, not diagnostic certainty.

ALLERGIES
- Explicit no-known-allergy becomes none_reported.
- If the patient does not know, use unknown.
- Never convert unknown to none_reported.

MEDICAL HISTORY
- Capture explicit ongoing illnesses or relevant medical history, such as "high BP" or "no diabetes".
- Preserve negative information when explicitly stated, because it answers a clinical question.
- Do not turn a bare "yes" into a disease. The question/context must identify what the yes refers to.
- Use concise clinical labels, e.g. "high blood pressure", "no diabetes".

CURRENT MEDICATIONS
- Capture only medications explicitly reported, e.g. "BP tablets" if that is all the patient says.
- Do not invent names, doses, frequencies or indications.
- Do not recommend medication changes.
- Keep "not tried" under the complaint's treatment_tried field, not under current_medications.

RED FLAGS
- Represent only explicitly identified patient-reported concerning symptoms.
- A bare "yes" is NOT a red flag unless the preceding question clearly identifies what the yes answers.
- Do not output diagnoses or tell the doctor what action to take.

VITALS
- Never invent vitals. Unless a structured vital was supplied in the session, return null for that vital.

PROVENANCE
- Complaints, allergies, medical history and current medications from the conversation are patient_reported.
- Do not claim doctor or desk provenance unless actually supplied.

COMPLETION
- Set each boolean according to whether that category was actually obtained.
- An empty category is not automatically none_reported.
- screening_complete reflects completion of the screening conversation.

SUMMARY
- Provide a concise human-readable summary using explicit field labels so the meaning is obvious.
- Example style:
  "Problem: ear blockage. Side: left. Duration: 3 days. Course: worsening. Associated symptoms: dizziness, discharge. Dizziness description: spinning sensation. Impact: unable to sleep. Treatment tried: none. Allergies: no known allergy. Medical history: high blood pressure; no diabetes. Current medications: BP tablets. Severity: severe."
- Do not include diagnosis, prescription, treatment recommendation, or instruction to the doctor.

Return JSON only.
`.trim();
export async function consolidate(session) {
  const transcript = (session.conversation || []).
    map((x) => `${x.role === "patient" ? "Patient" : "Doctor"}: ${x.message}`).
    join("\n");
  const startedAt = session.created_at || session.started_at || null;
  const input = `screening_id: ${session.screening_id}\nspecialty: ${session.patient?.specialty || "ent"}\npatient: ${JSON.stringify(session.patient)}\nconversation:\n${transcript}`;
  const base = {
    contract_version: "1.1", screening_id: session.screening_id,
    screening: { screening_id: session.screening_id, status: "completed", started_at: startedAt, completed_at: new Date().toISOString() },
    patient: { patient_id: session.patient?.patient_id || null, name: session.patient?.patient_name || null, age: session.patient?.age ?? null, age_unit: "Y", gender: session.patient?.gender || null, phone_last10: String(session.patient?.phone || "").replace(/\D/g, "").slice(-10) || null, date: new Date().toISOString().slice(0, 10) },
    vitals: { bp: null, pulse: null, temperature: null, spo2: null, weight: null, respiratory_rate: null, rbs: null },
    complaints: [], allergies: { status: "unknown", items: [] }, medical_history: { status: "unknown", items: [] }, current_medications: { status: "unknown", items: [] },
    red_flags: [], provenance: { complaints: "patient_reported", allergies: "patient_reported", medical_history: "patient_reported", current_medications: "patient_reported", vitals: {} },
    completion: { patient_details: true, vitals: false, complaints: false, allergies: false, medical_history: false, current_medications: false, screening_complete: true },
    summary: session.patient?.complaint || "See conversation transcript.", screening_status: "completed", patient_approved: false, submitted_at: null, data_quality_notes: []
  };
  try {
    const raw = await sarvamChat([
      { role: "system", content: consolidationInstructions },
      { role: "user", content: input },
    ], {
      temperature: 0.1, max_tokens: 2500,
      response_format: { type: "json_schema", json_schema: { name: "clinical_screening_contract_v1_1", strict: true, schema: outputSchema } },
    });
    const parsed = extractJsonObject(raw);
    if (parsed && typeof parsed === "object") {
      return {
        ...base, ...parsed, contract_version: "1.1", screening_id: session.screening_id,
        screening: { ...base.screening, ...(parsed.screening || {}), screening_id: session.screening_id },
        patient: { ...base.patient, ...(parsed.patient || {}) },
        vitals: { ...base.vitals, ...(parsed.vitals || {}) },
        provenance: { ...base.provenance, ...(parsed.provenance || {}) },
        completion: { ...base.completion, ...(parsed.completion || {}) },
        medical_history: { ...base.medical_history, ...(parsed.medical_history || {}) },
      };
    }
  } catch (err) { console.error("consolidate error", err?.message || err); }
  const sites = detectSite(session);
  const pt = patientText(session);
  base.complaints = sites.map((s, i) => ({ id: `c${i + 1}`, text: s === "ear" ? "Ear symptoms" : s === "nose" ? "Nasal symptoms" : "Throat symptoms", laterality: "unknown", duration: { value: null, unit: "unknown" }, course: "unknown", severity: "unknown", associated_symptoms: [], qualifiers: [], impact: "", treatment_tried: { status: "unknown", items: [] }, priority: i === 0 ? "chief" : "secondary", source: "patient_reported", confidence: "low" }));
  base.completion.complaints = base.complaints.length > 0;
  base.summary = pt.slice(0, 1200) || base.summary;
  base.data_quality_notes = ["fallback_summary"];
  return base;
}

function buildLegacySummary(contract) {
  const bits = [];
  (contract.complaints || []).forEach((c) => {
    const parts = [c.text];
    if (c.laterality && !["unknown", "not_applicable"].includes(c.laterality)) parts.push(`Side: ${c.laterality}`);
    if (c.duration?.value != null && c.duration?.unit !== "unknown") parts.push(`Duration: ${c.duration.value} ${c.duration.unit}`);
    if (c.course && c.course !== "unknown") parts.push(`Course: ${c.course}`);
    if (Array.isArray(c.associated_symptoms) && c.associated_symptoms.length) parts.push(`Associated: ${c.associated_symptoms.join(", ")}`);
    if (Array.isArray(c.qualifiers) && c.qualifiers.length) parts.push(`Details: ${c.qualifiers.join(", ")}`);
    if (c.impact) parts.push(`Impact: ${c.impact}`);
    if (c.treatment_tried?.status === "none") parts.push("Treatment tried: none");
    else if (c.treatment_tried?.items?.length) parts.push(`Treatment tried: ${c.treatment_tried.items.join(", ")}`);
    if (c.severity && c.severity !== "unknown") parts.push(`Severity: ${c.severity}`);
    if (parts.length) bits.push(parts.join(". "));
  });
  if ((contract.red_flags || []).length) bits.push("Red flags reported: " + contract.red_flags.map((x) => x.text).join(", "));
  if (contract.allergies?.status === "none_reported") bits.push("Allergies: no known allergy");
  else if (contract.allergies?.items?.length) bits.push("Allergies: " + contract.allergies.items.join(", "));
  if (contract.medical_history?.items?.length) bits.push("Medical history: " + contract.medical_history.items.join(", "));
  if (contract.current_medications?.status === "none_reported") bits.push("Current medications: none reported");
  else if (contract.current_medications?.items?.length) bits.push("Current medications: " + contract.current_medications.items.join(", "));
  return bits.join("\n") || "See conversation transcript.";
}
