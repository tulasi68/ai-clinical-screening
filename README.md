# AI Clinical Screening

**Repository:** `tulasi68/ai-clinical-screening`  
**Branch:** `main`  
**Latest audited commit:** `621de624ada8516b6734e6e244a0ef87ce0e3e0b` — 26 Sep 2026  
**Version:** `1.0.0`  
**Runtime:** Node.js 24.x  
**Framework:** Express 5  
**AI model:** Sarvam `sarvam-105b`  
**Persistence:** Supabase  
**Deployment:** Vercel-compatible Node/Express service

> **Important:** This is a separate application from `tulasi68/mediloop-ai`. MediLoop creates screening sessions through this service and retrieves the consolidated screening output through authenticated server-to-server API calls. The two applications should remain separate.

## 1. Purpose

AI Clinical Screening is a **pre-consultation history-taking service**.

A clinic application provides patient details and a complaint. This service creates a patient-specific link. The patient opens the link in a browser and has a natural, one-question-at-a-time conversation with a Sarvam-powered clinical-history assistant.

The service then:

1. collects patient answers;
2. asks relevant follow-up questions;
3. builds a structured pre-consultation history;
4. lets the patient review the resulting summary;
5. requires explicit patient submission;
6. exposes the submitted output to the calling clinic application.

The assistant **does not prescribe medication or provide a diagnosis**. Its purpose is to collect and organize history for clinician review.

## 2. Architecture

```
                 MEDILOOOP
                    │
                    │ POST /api/screenings
                    │ x-api-key
                    ▼
        ┌─────────────────────────┐
        │ AI Clinical Screening   │
        │ Express API             │
        └────────────┬────────────┘
                     │
                     ├── Supabase
                     │   sessions
                     │   outputs
                     │
                     ▼
              patient_url
                     │
                     ▼
             Patient browser
                     │
                     ▼
          Natural doctor-style chat
                     │
                     ▼
          Sarvam sarvam-105b
                     │
                     ▼
        Structured clinical summary
                     │
                     ▼
             Patient review
                     │
                     │ Send to doctor
                     ▼
              Submitted output
                     │
                     ▼
              MediLoop polls
       /api/screenings/:id/output
```

**Important:** The patient conversation is a **browser chat**, not an inbound WhatsApp chatbot.

## 3. Patient workflow

```
Open screening link
       ↓
Before your consultation
       ↓
Start
       ↓
Doctor-style chat
       ↓
One answer at a time
       ↓
Adaptive follow-up
       ↓
Clinical history consolidated
       ↓
Patient sees summary
       ↓
Patient selects "Send to doctor"
       ↓
Confirmation
       ↓
Screening becomes submitted
```

The current patient UI is intentionally lightweight: a single HTML page with chat bubbles, text input and a final summary.

## 4. Clinical conversation design

The current implementation treats Sarvam as a **specialty doctor taking a pre-consultation history**, rather than a generic chatbot.

The strongest specialty implementation currently is ENT. The ENT history aims to establish:

- site: ear, nose, throat or combination;
- exact symptoms;
- laterality;
- duration and course;
- severity;
- important associated features;
- medicines/drops already tried;
- drug allergies;
- relevant ongoing illnesses/regular medicines;
- urgent/red-flag features.

The conversation is adaptive and should not repeat information already supplied by the patient.

The code also has deterministic coverage checks and fallback questions so that a temporary model failure does not necessarily terminate the conversation.

## 5. AI architecture

Core file: `src/ai.js`.

### Next-question flow

```
Session
  ↓
Conversation transcript
  ↓
Specialty context
  ↓
Coverage detection
  ↓
Missing-history hints
  ↓
Sarvam doctor persona
  ↓
Structured JSON
  ↓
QUESTION / COMPLETE / URGENT
```

Sarvam endpoint:

```text
https://api.sarvam.ai/v1/chat/completions
```

Authentication uses:

```text
api-subscription-key: SARVAM_API_KEY
```

The implementation includes:

- structured JSON response parsing;
- retry handling for selected 429/503/model-overload errors;
- truncated-JSON recovery;
- empty-response retry;
- deterministic clinical fallback questions;
- repeat-question detection;
- minimum/maximum question controls;
- early-completion guardrails;
- fallback summary generation.

### Consolidation

```
Conversation
    ↓
Sarvam consolidation prompt
    ↓
Structured clinical output
    ↓
Supabase screening_outputs
```

The consolidation prompt instructs the model to use only facts supplied by the patient/session and not invent diagnoses, drugs, allergies or findings.

## 6. API contract

### Create screening

```http
POST /api/screenings
x-api-key: <SCREENING_API_KEY>
Content-Type: application/json
```

Request:

```json
{
  "patient_name": "Patient Name",
  "age": 35,
  "gender": "female",
  "complaint": "Ear pain for three days",
  "phone": "9876543210",
  "specialty": "ent"
}
```

Required fields:

- `patient_name`
- `age`
- `gender`
- `complaint`
- `phone`

`specialty` is optional and currently defaults to ENT behaviour.

Response:

```json
{
  "screening_id": "SCR-20260926-ABC123",
  "status": "in_progress",
  "patient_url": "https://your-screening-domain/s/<token>",
  "specialty": "ent"
}
```

### Read screening

```http
GET /api/screenings/:id
x-api-key: <SCREENING_API_KEY>
```

Returns the server-side screening session. The patient token hash is not exposed.

### Read final output

```http
GET /api/screenings/:id/output
x-api-key: <SCREENING_API_KEY>
```

Before completion, the service returns an in-progress response. After consolidation, it returns the structured screening output.

### Health

```http
GET /health
```

Current response identifies:

```json
{
  "ok": true,
  "service": "ai-clinical-screening",
  "architecture": "browser-screening",
  "link_delivery": "consumer_application",
  "inbound_whatsapp_conversation": false
}
```

## 7. Patient API

Patient access uses the token embedded in the screening URL.

| Route | Purpose |
|---|---|
| `GET /api/patient/s/:token` | Load patient-safe session/output |
| `POST /api/patient/s/:token/start` | Start conversation |
| `POST /api/patient/s/:token/message` | Submit one patient answer |
| `GET /api/patient/s/:token/summary` | Read available summary |
| `PUT /api/patient/s/:token/summary` | Update allowed summary fields while awaiting review |
| `POST /api/patient/s/:token/submit` | Patient explicitly approves/submits summary |

The patient's phone number is removed from public session/output responses.

## 8. Patient-token security

Patient links use cryptographically random tokens.

Only the **SHA-256 hash** of the token is stored in the database.

Default lifetime:

```text
PATIENT_TOKEN_TTL_HOURS=72
```

Expired/invalid links are rejected.

Do not log or persist raw patient tokens unnecessarily.

## 9. Persistence

Core file: `src/store.js`.

The current production store uses the Supabase REST API with the service-role key.

Logical tables:

### `screening_sessions`

Stores:

- screening ID;
- status;
- timestamps;
- patient context;
- conversation;
- question count;
- patient-token hash;
- token expiry;
- inbound message metadata where applicable.

### `screening_outputs`

Stores:

- screening ID;
- structured output.

The current production architecture does not rely on local JSON files for durable state.

## 10. Environment variables

Use `.env.example` as the template.

### Sarvam

```text
SARVAM_API_KEY=
SARVAM_MODEL=sarvam-105b
```

### MediLoop/server authentication

```text
SCREENING_API_KEY=
```

The server also accepts `CLINICAL_SCREENING_API_KEY` as a compatibility alias.

MediLoop sends:

```http
x-api-key: <same secret>
```

### Patient URL

```text
PATIENT_APP_URL=https://your-screening-domain
```

This must be the public domain from which `/s/<token>` can be opened.

Do not use localhost in production.

### Supabase

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

**Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.**

### Conversation limits

```text
MAX_QUESTIONS=12
MIN_QUESTIONS=3
PATIENT_TOKEN_TTL_HOURS=72
```

The AI logic also has internal minimum/maximum defaults. If changing limits, keep the configuration and AI guardrails aligned deliberately.

### Optional WhatsApp

```text
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=
WA_API_VERSION=v21.0
WA_WEBHOOK_VERIFY_TOKEN=
WA_APP_SECRET=
WA_COMPLAINT_TEMPLATE_NAME=mediloop_add_complaints
WA_COMPLAINT_TEMPLATE_LANGUAGE=en
```

WhatsApp is not required for the core browser screening conversation.

## 11. MediLoop integration

MediLoop configuration:

```text
CLINICAL_SCREENING_URL=https://<screening-service>
CLINICAL_SCREENING_API_KEY=<same-as-SCREENING_API_KEY>
```

Flow:

```
MediLoop
  │
  │ POST /api/screenings
  │ x-api-key
  ▼
AI Clinical Screening
  │
  │ screening_id + patient_url
  ▼
MediLoop
  │
  │ gives patient the link
  ▼
Patient browser
  │
  │ conversation
  ▼
AI Clinical Screening
  │
  │ final output
  ▼
MediLoop
  │
  │ GET /api/screenings/:id/output
  ▼
Doctor workflow
```

### Critical configuration rule

These two secrets must match:

```text
MediLoop:
CLINICAL_SCREENING_API_KEY

Screening service:
SCREENING_API_KEY
```

A mismatch produces:

```text
401 Unauthorized screening service request.
```

## 12. WhatsApp boundary

The current architecture does **not** use WhatsApp as the patient conversation channel.

WhatsApp is optional link delivery:

```
WhatsApp message
      ↓
patient taps link
      ↓
browser opens
      ↓
screening chat
      ↓
patient submits summary
```

The health endpoint explicitly reports:

```text
inbound_whatsapp_conversation: false
```

This keeps the patient interaction simple and avoids a separate WhatsApp conversational state machine.

## 13. Safety boundaries

This application is for **history collection and clinical summarization**, not autonomous clinical decision-making.

The AI must not:

- prescribe medicines;
- recommend a treatment plan;
- invent findings;
- invent allergies;
- invent diagnoses;
- replace the clinician's consultation;
- suppress genuine urgent-care warnings.

The ENT persona explicitly instructs Sarvam to take history without prescribing.

The final output is intended for clinician review.

## 14. Complete file inventory

### Root

| File | Purpose |
|---|---|
| `package.json` | Node metadata, dependencies and start/dev scripts |
| `package-lock.json` | npm dependency lockfile |
| `.env.example` | Environment-variable template |
| `.gitignore` | Excludes secrets, dependencies and runtime data |
| `README.md` | This architecture/developer guide |

### `src/`

| File | Purpose |
|---|---|
| `src/server.js` | **Main Express application and HTTP routes** |
| `src/ai.js` | Sarvam integration, doctor persona, questioning, coverage, fallbacks and consolidation |
| `src/store.js` | Supabase persistence, screening IDs, patient tokens and session/output access |

### `public/`

| File | Purpose |
|---|---|
| `public/index.html` | **Patient-facing browser screening UI** |

The UI is intentionally a lightweight standalone HTML/CSS/JavaScript application served by Express.

## 15. AI coding assistant — start here

Read in this order:

1. `src/server.js`
2. `src/ai.js`
3. `src/store.js`
4. `public/index.html`
5. `.env.example`
6. `package.json`

### UI changes

Read:

- `public/index.html`;
- patient routes in `src/server.js`.

Do not introduce a framework unnecessarily.

### AI-question changes

Read:

- `doctorPersona()`;
- `coverage()`;
- `prescribeReady()`;
- `missingHints()`;
- `fallbackDoctorQuestion()`;
- `nextStep()`.

Preserve one-question-at-a-time behaviour, natural language, no diagnosis/prescription, repeat prevention and deterministic fallbacks.

### Output changes

If changing the output schema, update:

- `outputSchema` in `src/ai.js`;
- patient `formatSummary()` in `public/index.html`;
- MediLoop's consumer assumptions.

Do not silently rename output fields.

### Persistence changes

Read `src/store.js` first.

Preserve:

- hashed patient tokens;
- token expiry;
- screening IDs;
- session/output separation;
- Supabase authentication;
- no service-role credentials in browser code.

## 16. Safe development workflow

### Locate the owning layer

```
Patient UI       → public/index.html
HTTP/API         → src/server.js
AI behaviour     → src/ai.js
Persistence      → src/store.js
Configuration    → .env.example
Dependencies     → package.json
```

### Preserve contracts

Before changing code, check:

- endpoint path;
- HTTP method;
- authentication header;
- request JSON;
- response JSON;
- screening ID;
- patient URL;
- output fields;
- token behaviour;
- submission state.

### Make the smallest change

Avoid rewriting the service for a prompt or UI change.

### Validate

```bash
npm install
npm run dev
```

Health:

```text
GET http://localhost:3000/health
```

There is currently no automated test script in `package.json`.

### Full smoke test

```
POST /api/screenings
        ↓
receive patient_url
        ↓
open patient_url
        ↓
Start
        ↓
answer questions
        ↓
receive summary
        ↓
Send to doctor
        ↓
GET /api/screenings/:id/output
        ↓
verify submitted output
```

## 17. Deployment

The service is a Node/Express application designed to run on Vercel or another Node-compatible host.

Production environment variables must be configured in the deployment platform; local `.env` values do not automatically exist in Vercel.

At minimum:

```text
SARVAM_API_KEY
SARVAM_MODEL
SCREENING_API_KEY
PATIENT_APP_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Optional WhatsApp variables are needed only for link delivery from this service.

### Production checklist

- [ ] `PATIENT_APP_URL` points to the public screening domain.
- [ ] `SCREENING_API_KEY` is configured.
- [ ] MediLoop's `CLINICAL_SCREENING_API_KEY` exactly matches it.
- [ ] `SARVAM_API_KEY` is configured.
- [ ] `SARVAM_MODEL` is correct.
- [ ] Supabase URL is correct.
- [ ] Supabase service-role key is current.
- [ ] Supabase tables exist.
- [ ] `/health` returns OK.
- [ ] A screening can be created.
- [ ] The patient URL opens.
- [ ] Patient answers persist.
- [ ] A summary is generated.
- [ ] Patient submission succeeds.
- [ ] MediLoop retrieves the final output.

## 18. Current architectural decisions

1. **Separate application:** AI Clinical Screening remains independent from MediLoop.
2. **Browser conversation:** the patient conversation occurs through a browser link, not inbound WhatsApp chat.
3. **Sarvam:** `sarvam-105b` is the current LLM configuration.
4. **Supabase:** durable session/output persistence is externalized to Supabase.
5. **Patient approval:** the patient explicitly sends the final summary.
6. **Clinician responsibility:** the screening service collects history; the clinician remains responsible for diagnosis, treatment and prescribing.

## 19. Do not do these things casually

1. Do not merge this repository into MediLoop.
2. Do not move the patient conversation into WhatsApp without an explicit architecture decision.
3. Do not expose `SUPABASE_SERVICE_ROLE_KEY`.
4. Do not expose `SARVAM_API_KEY`.
5. Do not remove server-to-server API authentication.
6. Do not store raw patient tokens when a hash is sufficient.
7. Do not remove token expiry.
8. Do not make Sarvam prescribe.
9. Do not make the summary appear to be a diagnosis.
10. Do not silently change the output schema consumed by MediLoop.
11. Do not remove the deterministic fallback path.
12. Do not remove patient confirmation before submission.
13. Do not assume every specialty has the same depth as ENT.
14. Do not treat the old WhatsApp-chat architecture as the current conversation architecture.

## 20. Relationship to MediLoop

```
┌──────────────────────────────┐
│ MediLoop Clinical AI         │
│                              │
│ Clinic workflow              │
│ Registration                 │
│ Consultation                │
│ Evidence / RAG               │
│ Prescription                 │
│ Billing                      │
│ Outcomes                     │
└──────────────┬───────────────┘
               │
               │ authenticated HTTP
               ▼
┌──────────────────────────────┐
│ AI Clinical Screening        │
│                              │
│ Patient link                 │
│ Browser chat                 │
│ Sarvam history taking        │
│ Clinical consolidation       │
│ Patient approval             │
│ Structured output             │
└──────────────────────────────┘
```

Neither application needs to contain the other's source code.

## 21. Final developer rule

**AI Clinical Screening is a pre-consultation history collection service, not an autonomous clinical decision-maker.**

Preserve:

```
Simple patient experience
        +
Natural one-question-at-a-time history
        +
Structured clinical output
        +
Explicit patient approval
        +
Authenticated MediLoop integration
        +
Secure token handling
        +
Durable Supabase persistence
        +
Clinician remains responsible for diagnosis/prescribing
```

When in doubt, start with `src/server.js`, then trace into `src/ai.js` and `src/store.js` before changing behaviour.
