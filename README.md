# AI Clinical Screening

A small Utsavam-style browser conversation for collecting structured pre-consultation information.

## Architecture

```
MediLoop
   │
   ├── creates screening session
   │
   └── sends patient a WhatsApp link
                 │
                 ▼
        Small browser chat
                 │
                 ▼
             Sarvam AI
                 │
                 ▼
       Patient reviews/edits
                 │
                 ▼
        End & Send to Doctor
                 │
                 ▼
              MediLoop
```

WhatsApp is only the delivery channel for the link. This service does **not** run a WhatsApp chatbot and does **not** consume inbound WhatsApp patient replies.

The conversation is deliberately limited to information collection and structuring. It does not diagnose, prescribe, recommend treatment, or make clinical decisions.

## Patient experience

1. Patient opens the private screening link.
2. Patient sees a small welcome screen and presses **Start Chat**.
3. Sarvam asks one short question at a time and adapts to the answers.
4. When enough information has been collected, the patient sees a structured screening summary.
5. Patient can correct the information.
6. Patient presses **End & Send to Doctor**.
7. The final structured JSON becomes available to MediLoop.

The interaction is intentionally modeled on Utsavam's **Talk about this** pattern: a quiet, private conversation rather than a large application workflow.

## API

### Create a screening

```http
POST /api/screenings
Content-Type: application/json
X-API-Key: <SCREENING_API_KEY>
```

Bearer authentication is also accepted:

```http
Authorization: Bearer <SCREENING_API_KEY>
```

Body:

```json
{
  "patient_name": "Ravi Kumar",
  "age": 42,
  "gender": "Male",
  "complaint": "Ear pain for 3 days",
  "phone": "+91XXXXXXXXXX"
}
```

Response:

```json
{
  "screening_id": "SCR-...",
  "status": "in_progress",
  "patient_url": "https://YOUR-DOMAIN/s/<opaque-token>"
}
```

MediLoop is responsible for sending `patient_url` to the patient through WhatsApp.

### Retrieve completed screening

```http
GET /api/screenings/SCR-.../output
X-API-Key: <SCREENING_API_KEY>
```

Returns the consolidated structured JSON after the patient has submitted the screening.

### Health check

```http
GET /health
```

## Security model

- The patient link contains a high-entropy opaque token.
- Only a SHA-256 hash of the patient token is stored.
- Patient tokens expire after `PATIENT_TOKEN_TTL_HOURS`.
- Patient-facing routes do not expose the patient's phone number.
- Server-to-server screening endpoints require `SCREENING_API_KEY` outside local development.
- The Supabase service-role key is server-side only and must never be exposed to browser code.

## Storage

Screening sessions and consolidated outputs are stored in Supabase. The service does not rely on local JSON files or serverless filesystem persistence.

## Local setup

```bash
npm install
copy .env.example .env
npm start
```

Open:

```
http://localhost:3000
```

For an actual patient session, first create a screening through `POST /api/screenings` and open the returned `patient_url`.

## Clinical boundary

This service collects and structures patient-provided information for clinician review. It is not a diagnostic or treatment system.

Before real clinical deployment, validate the workflow clinically and implement the required privacy, consent/notice, access-control, audit, monitoring, retention, and operational controls.
