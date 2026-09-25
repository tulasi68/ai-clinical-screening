# AI Clinical Screening

Standalone API for adaptive clinical information collection over WhatsApp.

## Flow

1. Consumer sends `POST /api/screenings` with exactly the patient JSON.
2. Service creates a `screening_id` and sends the patient a WhatsApp message.
3. OpenAI asks one question at a time and adapts to patient answers.
4. Meta WhatsApp webhook delivers replies to `/webhooks/whatsapp`.
5. When sufficient information is collected, OpenAI consolidates the conversation into strict structured JSON.
6. Consumer retrieves `GET /api/screenings/:id/output`.

OpenAI is used through the Responses API; the model is configurable with `OPENAI_MODEL`. Structured Outputs is used for the final JSON and for the question-control response. OpenAI documents the Responses API and JSON-schema structured output support. See the official docs linked in the project notes.

## Reusing MediLoop Meta WhatsApp

The current MediLoop code uses:
- `WA_PHONE_NUMBER_ID`
- `WA_ACCESS_TOKEN`
- `WA_API_VERSION`
- `WA_WEBHOOK_VERIFY_TOKEN`

This project deliberately uses the same names so the existing values can be reused without putting credentials in code.

Important: a Meta app/webhook has one configured callback URL. If the same Meta app/number is shared, point Meta's webhook at this service and set `MEDILOOP_WEBHOOK_FORWARD_URL` to the current MediLoop webhook. This service routes messages belonging to an active screening session here and forwards other webhook payloads to MediLoop.

## Install

```bash
npm install
cp .env.example .env
npm start
```

## Start a screening

```bash
curl -X POST http://localhost:3000/api/screenings \\
  -H 'Content-Type: application/json' \\
  -d '{"patient_name":"Ravi Kumar","age":42,"gender":"Male","complaint":"Ear pain for 3 days","phone":"+91XXXXXXXXXX"}'
```

Response:

```json
{"screening_id":"SCR-...","status":"started"}
```

## Get completed JSON

```bash
curl http://localhost:3000/api/screenings/SCR-.../output
```

## Meta webhook

Set the callback URL to:

`https://YOUR-DOMAIN/webhooks/whatsapp`

Verify token must equal `WA_WEBHOOK_VERIFY_TOKEN`.

For proactive messages outside WhatsApp's customer-service window, configure an approved Meta template in `WA_INITIAL_TEMPLATE_NAME`. If no template is configured, the service sends a text message; Meta may reject that outbound message when a customer-service window is not open.

## Safety boundary

This service collects and structures information. It does not diagnose, prescribe, recommend treatment, or make clinical decisions. It is not a substitute for a clinician. Real deployment requires appropriate privacy/security controls, consent/notice, auditability, durable storage, monitoring, and clinical validation.

## Storage

The included JSON-file store is intentionally simple for a prototype. Do not use it as the production persistence layer on a multi-instance/serverless deployment. Replace `src/store.js` with a durable database before production.
