# AI Clinical Screening

Standalone API for adaptive clinical information collection over WhatsApp.

## Flow

1. A consumer application sends `POST /api/screenings` with patient JSON.
2. The service creates a `screening_id` and sends the patient a WhatsApp message.
3. Sarvam AI asks one question at a time and adapts to patient answers.
4. Meta WhatsApp delivers patient replies to `/webhooks/whatsapp`.
5. When sufficient information is collected, Sarvam AI consolidates the conversation into strict structured JSON.
6. The consumer application retrieves `GET /api/screenings/:id/output`.

The AI is deliberately limited to information collection and structuring. It does not diagnose, prescribe, recommend treatment, or make clinical decisions.

## API

### Start a screening

```http
POST /api/screenings
Content-Type: application/json
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
{"screening_id":"SCR-...","status":"started"}
```

The Authorization header is required when `SCREENING_API_KEY` is configured.

### Get completed JSON

```http
GET /api/screenings/SCR-.../output
Authorization: Bearer <SCREENING_API_KEY>
```

### Get screening status

```http
GET /api/screenings/SCR-...
Authorization: Bearer <SCREENING_API_KEY>
```

The patient phone number is never returned by this endpoint.

## Meta WhatsApp

Set the callback URL to:

`https://YOUR-DOMAIN/webhooks/whatsapp`

The Meta verification token must equal `WA_WEBHOOK_VERIFY_TOKEN`.

For proactive messages outside WhatsApp's customer-service window, configure an approved Meta template in `WA_INITIAL_TEMPLATE_NAME`. If no template is configured, the service sends a text message; Meta may reject that outbound message when a customer-service window is not open.

If the same Meta app/number is shared with MediLoop, this service can forward non-screening webhook payloads to `MEDILOOP_WEBHOOK_FORWARD_URL`.

## Storage

The current `src/store.js` implementation uses JSON files intentionally for development and controlled pilot testing.

This is **not durable production storage on a serverless deployment**. The storage interface is kept isolated so it can be replaced with Supabase/Postgres later without changing the screening workflow or API contract.

## Local setup

```bash
npm install
copy .env.example .env
npm start
```

Health check:

```
GET /health
```

## Safety boundary

This service collects and structures information. It does not diagnose, prescribe, recommend treatment, or make clinical decisions. It is not a substitute for a clinician.

Before real clinical deployment, implement appropriate privacy/security controls, consent/notice, durable storage, auditability, monitoring, access control, and clinical validation.

## Runtime

The project targets Node.js 24.x for deployment. Vercel currently supports Express/Node server deployments, but the JSON datastore must be replaced before relying on deployment persistence.
