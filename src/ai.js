//src/ai.js

const SARVAM_API_URL = "https://api.sarvam.ai/v1/chat/completions";

const SARVAM_MODEL = process.env.SARVAM_MODEL || "sarvam-105b";

function getSarvamApiKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("Missing SARVAM_API_KEY environment variable.");
  return key;
}

async function sarvamChat(messages, options = {}) {
  const body = {
    model: SARVAM_MODEL,
    messages,
    temperature: options.temperature ?? 0.2,
    reasoning_effort: options.reasoning_effort ?? null,
    max_tokens: options.max_tokens ?? 500
  };

  if (options.response_format) {
    body.response_format = options.response_format;
  }

  const response = await fetch(SARVAM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": getSarvamApiKey()
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Sarvam API error ${response.status}: ${JSON.stringify(data)}`
    );
  }

  const content = data.choices?.[0]?.message?.content;

  const cleaned = String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (!cleaned) {
    throw new Error(
      `Sarvam returned no message content: ${JSON.stringify(data)}`
    );
  }

  return cleaned;
}


/*
 * ============================================================
 * NEXT QUESTION
 * ============================================================
 */

const conversationInstructions = `
You are a clinical information-collection assistant communicating
with a patient over WhatsApp.

Your job is ONLY to collect and clarify information for a healthcare
professional.

You do NOT:
- diagnose
- prescribe
- recommend medicines
- recommend treatment
- make treatment decisions

Ask exactly ONE short, plain-language question at a time.

Adapt the next question to what the patient has already said.
Do not mechanically run a fixed questionnaire.

Prioritize clinically useful missing information such as:
- onset and duration
- location
- severity
- pattern
- associated symptoms
- relevant medical history
- current medicines
- allergies
- important warning symptoms when appropriate to the complaint

Do not invent facts.

If the patient says they do not know, accept that.

Avoid alarming language.

If the conversation has enough useful information, return COMPLETE
instead of another question.

If the patient mentions an emergency or severe warning symptom:
- do not diagnose
- advise them to seek urgent medical care immediately
- return COMPLETE/URGENT

Output JSON only.
`.trim();

const nextSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["QUESTION", "COMPLETE", "URGENT"]
    },
    message: {
      type: "string"
    },
    reason: {
      type: "string"
    }
  },
  required: ["status", "message", "reason"]
};


export async function nextStep(session) {
  const transcript = session.conversation
    .map(
      x =>
        `${x.role === "patient" ? "PATIENT" : "ASSISTANT"}: ${x.message}`
    )
    .join("\n");

  const input = `
Patient:
${JSON.stringify(session.patient)}

Conversation so far:
${transcript || "(none)"}

Questions asked:
${session.question_count}

Maximum questions:
${process.env.MAX_QUESTIONS || 12}
`.trim();

  const raw = await sarvamChat(
    [
      {
        role: "system",
        content: conversationInstructions
      },
      {
        role: "user",
        content: input
      }
    ],
    {
      temperature: 0.2,
      reasoning_effort: null,
      max_tokens: 300,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "next_step",
          strict: true,
          schema: nextSchema
        }
      }
    }
  );

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Sarvam returned invalid JSON for nextStep: ${raw}`
    );
  }
}


/*
 * ============================================================
 * CLINICAL CONSOLIDATION
 * ============================================================
 */

const outputSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    screening_id: {
      type: "string"
    },

    patient: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: {
          type: ["string", "null"]
        },
        age: {
          type: ["integer", "null"]
        },
        gender: {
          type: ["string", "null"]
        },
        phone: {
          type: ["string", "null"]
        }
      },
      required: [
        "name",
        "age",
        "gender",
        "phone"
      ]
    },

    presenting_complaint: {
      type: ["string", "null"]
    },

    symptoms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          symptom: {
            type: "string"
          },
          duration: {
            type: ["string", "null"]
          },
          severity: {
            type: ["string", "null"]
          },
          location: {
            type: ["string", "null"]
          },
          details: {
            type: ["string", "null"]
          }
        },
        required: [
          "symptom",
          "duration",
          "severity",
          "location",
          "details"
        ]
      }
    },

    associated_symptoms: {
      type: "array",
      items: {
        type: "string"
      }
    },

    medical_history: {
      type: "array",
      items: {
        type: "string"
      }
    },

    medications: {
      type: "array",
      items: {
        type: "string"
      }
    },

    allergies: {
      type: "array",
      items: {
        type: "string"
      }
    },

    red_flags: {
      type: "array",
      items: {
        type: "string"
      }
    },

    patient_concerns: {
      type: "array",
      items: {
        type: "string"
      }
    },

    summary: {
      type: "string"
    },

    screening_status: {
      type: "string",
      enum: ["completed", "urgent"]
    },

    data_quality_notes: {
      type: "array",
      items: {
        type: "string"
      }
    }
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
    "data_quality_notes"
  ]
};


const consolidationInstructions = `
Convert the completed patient conversation into structured clinical
information.

Use ONLY facts explicitly stated by the patient or supplied in the
input patient record.

Never infer or invent:
- diagnoses
- medicines
- allergies
- medical history
- symptoms
- severity
- duration
- red flags

Missing information must be represented as null or an empty array.

Do not provide:
- diagnosis
- treatment
- prescription
- medical advice

Preserve uncertainty in data_quality_notes.

The summary is a factual collection summary, not a clinical conclusion.

Output only the requested JSON structure.
`.trim();


export async function consolidate(session) {
  const transcript = session.conversation
    .map(
      x =>
        `${x.role === "patient" ? "PATIENT" : "ASSISTANT"}: ${x.message}`
    )
    .join("\n");

  const input = `
screening_id:
${session.screening_id}

patient record:
${JSON.stringify(session.patient)}

conversation:
${transcript}
`.trim();

  const raw = await sarvamChat(
    [
      {
        role: "system",
        content: consolidationInstructions
      },
      {
        role: "user",
        content: input
      }
    ],
    {
      temperature: 0.1,
      max_tokens: 2500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "clinical_screening",
          strict: true,
          schema: outputSchema
        }
      }
    }
  );

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Sarvam returned invalid JSON for consolidation: ${raw}`
    );
  }
}