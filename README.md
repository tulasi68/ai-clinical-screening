# AI Clinical Screening

**Repo:** `tulasi68/ai-clinical-screening`  
**Branch:** `main`  
**Version:** `1.0.0`  
**Runtime:** Node.js 24.x · Express 5  
**Persistence:** Supabase  
**Deploy:** Vercel / Cloudflare Workers–compatible Node service

Separate application from **`tulasi68/mediloop-ai`**. MediLoop creates sessions and polls submitted output over authenticated HTTP. Keep the two repos independent.

---

## Purpose

Pre-consultation **history collection**, not diagnosis or prescribing.

1. Clinic (MediLoop) posts patient demographics + specialty.
2. This service returns a one-time **patient link**.
3. Patient answers **one question at a time** in the browser (guided choices).
4. Answers are consolidated into **Contract 1.1** structured intake.
5. Patient reviews and **explicitly submits** to the doctor.
6. MediLoop fetches the output for the prescription workspace.

The assistant **must not** diagnose, prescribe, or invent findings.

---

## Architecture (current)

```
MediLoop
  │  POST /api/screenings  (x-api-key)
  ▼
AI Clinical Screening (Express)
  │  → Supabase (sessions + outputs)
  │  → patient_url
  ▼
Patient browser  (/s/<token>)
  │  fixed / cascading questions (flow + specialty packs)
  │  optional Sarvam only for consolidation / limited AI steps
  ▼
Patient review → Submit
  │
  ▼
MediLoop polls  GET /api/screenings/:id/output
```

**Patient conversation is browser chat, not inbound WhatsApp.**  
WhatsApp (if configured) is only for **delivering the link**.

### Question engine (important)

History-taking is primarily **deterministic**, not free-form LLM chat:

| Specialty | Source |
|-----------|--------|
| **ENT** | Fixed ear / nose / throat branches in `src/flow.js` |
| **General medicine** | Dedicated module `src/specialties/general_medicine/` |
| **Gynecology, Pediatrics, Orthopedics** | Cascading JSON packs under `src/specialties/question-packs/` |
| **Other specialties** (cardio, derm, …) | Shared **primary_care** cascading pack until a specialty pack is filled in |

Cascading packs follow:

```text
level1 (single chief complaint)
  → that complaint’s level2 / level3 only
  → shared_tail (severity, red flags, meds, allergies, …)
```

Engine: `src/specialties/generic/cascading.js`  
Registry / resolution: `src/specialties/index.js`, `packCodes.js`

Sarvam (`src/ai.js`) is used for **consolidation** into Contract 1.1 and limited fallback paths—not as the main question driver for ENT/GM/pack specialties.

---

## Patient workflow

```
Open link → Start → one question at a time (choice boxes)
  → adaptive next question from pack / ENT branch
  → consolidate history
  → patient sees summary
  → “Send to doctor”
  → status submitted → MediLoop can poll output
```

UI: lightweight `public/index.html` + `public/app.js` + `public/screening.css`.  
Choices carry stable option ids; the server stores **question → selected options** so consolidation is semantic, not a raw answer sequence.

---

## API (server-to-server)

Auth header: `x-api-key: <SCREENING_API_KEY>`  
(Also accepts `CLINICAL_SCREENING_API_KEY` as alias on this side.)

### Create screening

```http
POST /api/screenings
Content-Type: application/json
```

```json
{
  "patient_name": "Patient Name",
  "age": 45,
  "gender": "male",
  "complaint": "Knee pain after fall",
  "phone": "9876543210",
  "specialty": "orthopedics",
  "clinic_id": "optional",
  "queue_token": "optional",
  "waiting_ahead": 0,
  "ui_language": "en"
}
```

Required: `patient_name`, valid `age`, `phone`.  
`specialty` drives which question pack/branch is used (`ent`, `general_medicine`, `orthopedics`, `gynecology`, `pediatrics`, `primary_care`, …).

Response (shape):

```json
{
  "screening_id": "SCR-…",
  "status": "in_progress",
  "patient_url": "https://<PATIENT_APP_URL>/s/<token>",
  "specialty": "orthopedics"
}
```

### Session / output

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/screenings/:id` | Session metadata (no raw patient token) |
| `GET` | `/api/screenings/:id/output` | Structured intake when available / submitted |
| `GET` | `/health` | Liveness + architecture flags |

### Patient token routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/patient/s/:token` | Patient-safe session |
| `POST` | `/api/patient/s/:token/start` | Start |
| `POST` | `/api/patient/s/:token/message` | One answer |
| `GET`/`PUT` | `/api/patient/s/:token/summary` | Read / edit allowed summary fields |
| `POST` | `/api/patient/s/:token/submit` | Explicit patient approval |

Tokens are **hashed (SHA-256)** in the DB; default TTL `PATIENT_TOKEN_TTL_HOURS=72`. Phone is stripped from public patient payloads.

---

## Contract 1.1 (producer)

Detail: `docs/clinical-screening-contract-v1.md`.

Top-level clinical fields include: `contract_version`, `screening`, `patient`, `vitals`, `complaints[]`, `allergies`, `medical_history`, `current_medications`, `red_flags[]`, `provenance`, `completion`, plus integration fields (`summary`, `screening_status`, `patient_approved`, `submitted_at`, …).

Each complaint is **semantic** (text, laterality, duration, course, severity, associated symptoms, impact, treatment tried)—not an unexplained answer list.

MediLoop stores the full object and renders it read-only in the prescription workspace; the doctor’s prescription remains a separate editable field.

**Do not rename fields without versioning or explicit backward compatibility.**

---

## Specialty packs

```
src/specialties/
  index.js                 # resolve specialty → module
  packCodes.js             # specialty code → pack file name
  general_medicine/        # dedicated GM questions + i18n
  generic/
    cascading.js           # level1 → branch → shared_tail engine
    questions.js           # linear fallback if no pack
    index.js               # loads JSON packs
  question-packs/
    primary_care.json      # shared pack for many specialties
    gynecology.json        # full cascade
    pediatrics.json        # full cascade
    orthopedics.json       # full cascade (knee, back, neck, …)
    *.json                 # drafts → fall back to primary_care until populated
```

To add a specialty cascade:

1. Fill `question-packs/<name>.json` with valid `level1`, `complaints`, `shared_tail`.
2. Map codes in `packCodes.js`.
3. Import the pack in `generic/index.js` `STATIC_PACKS`.

---

## Environment

Template: `.env.example`

```text
SARVAM_API_KEY=
SARVAM_MODEL=sarvam-105b

SCREENING_API_KEY=                 # must match MediLoop CLINICAL_SCREENING_API_KEY
PATIENT_APP_URL=https://your-domain

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=         # never in browser code

PORT=3000
MAX_QUESTIONS=12
MIN_QUESTIONS=3
PATIENT_TOKEN_TTL_HOURS=72

# Optional WhatsApp link delivery only
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=
WA_API_VERSION=v21.0
WA_WEBHOOK_VERIFY_TOKEN=
WA_APP_SECRET=
WA_COMPLAINT_TEMPLATE_NAME=mediloop_add_complaints
WA_COMPLAINT_TEMPLATE_LANGUAGE=en
```

MediLoop side:

```text
CLINICAL_SCREENING_URL=https://<this-service>
CLINICAL_SCREENING_API_KEY=<same as SCREENING_API_KEY>
```

Mismatch → `401` from this service.

---

## Persistence

`src/store.js` — Supabase REST with service role.

| Table | Role |
|-------|------|
| `screening_sessions` | IDs, status, conversation, token hash, expiry, patient context |
| `screening_outputs` | Structured Contract output |

No local JSON as durable production state.

---

## Key source map

| Path | Role |
|------|------|
| `src/server.js` | HTTP routes, auth, patient + clinic APIs |
| `src/flow.js` | ENT fixed trees + specialty next-question wiring |
| `src/ai.js` | Sarvam consolidation / limited AI helpers |
| `src/deterministicContract.js` | Contract shaping from answers |
| `src/store.js` | Supabase sessions/outputs/tokens |
| `src/specialties/**` | GM + cascading packs |
| `public/index.html`, `app.js`, `screening.css` | Patient UI |
| `docs/clinical-screening-contract-v1.md` | Contract semantics |
| `vercel.json` / `wrangler.jsonc` | Deploy adapters |

---

## Local development

```bash
npm install
cp .env.example .env   # fill secrets
npm run dev            # node --watch src/server.js
curl http://localhost:3000/health
```

Smoke path:

```text
POST /api/screenings → open patient_url → answer → submit
→ GET /api/screenings/:id/output
```

---

## Deployment checklist

- [ ] `PATIENT_APP_URL` is the public screening origin (not localhost in prod)
- [ ] `SCREENING_API_KEY` set and matches MediLoop
- [ ] `SARVAM_*` set if consolidation is enabled
- [ ] Supabase URL + service role + tables present
- [ ] `/health` OK
- [ ] Create screening → patient UI → submit → MediLoop can read output

---

## Safety boundaries

- History only — no diagnosis, no prescriptions, no invented allergies/meds/findings.
- Patient must explicitly submit before the clinic treats the output as final.
- Clinician remains responsible for all clinical decisions.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `SARVAM_API_KEY` to the browser.
- Prefer hashed tokens; keep TTL; do not log raw tokens.

---

## Do not (without an explicit product decision)

1. Merge this repo into MediLoop.
2. Move the conversation channel to inbound WhatsApp chat.
3. Remove server-to-server API key checks.
4. Silently change Contract field names.
5. Replace deterministic packs with unconstrained LLM questioning for production specialties.
6. Drop patient confirmation before submit.

---

## Relationship to MediLoop

```
MediLoop Clinical AI          AI Clinical Screening
─────────────────────         ─────────────────────
Registration / queue          Patient link + browser Q&A
Consultation workspace        Deterministic / cascading history
RAG / evidence                Contract 1.1 consolidation
Prescription + billing        Explicit patient submit
Outcomes                      Authenticated output API
```

Neither codebase should embed the other.

---

## Final rule

**Pre-consultation history collection service — not an autonomous clinician.**

Preserve: simple patient UX · one question at a time · structured Contract 1.1 · explicit patient approval · authenticated MediLoop integration · secure tokens · durable Supabase state · clinician owns diagnosis and prescribing.

When changing behaviour, start at `src/server.js`, then `src/flow.js` / `src/specialties/`, then `src/ai.js` and `src/store.js`.
