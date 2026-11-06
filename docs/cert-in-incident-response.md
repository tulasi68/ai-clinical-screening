# CERT-In incident response runbook (AI Clinical Screening)

**Status:** Operational template. Bind to on-call contacts and confirm log retention in the Cloudflare account before treating as live.

## Already-binding duties (IT Act s.70B Directions, 28 April 2022)

1. Report specified cyber incidents to CERT-In **within 6 hours** of noticing or being informed.
2. Retain ICT system logs for a **rolling 180 days** within India.
3. Designate a point of contact for CERT-In correspondence.

Report channels (verify on https://www.cert-in.org.in):
- email: incident@cert-in.org.in
- phone / other channels published by CERT-In

## What is reportable (non-exhaustive)

- Unauthorised access to screening sessions, tokens, or service API keys
- Data leak / exposure of patient_json, conversation, or outputs
- Ransomware / destructive activity on Worker or D1
- Compromise of WhatsApp / messaging credentials used for patient links
- Suspicious AI-agent or automation activity against the service (see CERT-In AI guidance 2026)

## Immediate steps (first 6 hours)

1. Contain: rotate `SCREENING_API_KEY` / per-clinic keys; revoke affected patient tokens; disable compromised WhatsApp credentials.
2. Preserve evidence: export relevant Worker logs, D1 query samples (minimise patient content), deployment version, timestamps (UTC).
3. Notify CERT-In within 6 hours with: organisation, systems affected, nature of incident, date/time of detection, containment status, contact person.
4. Notify the clinic Data Fiduciary contact so they can assess patient notification under DPDP once those duties apply (May 2027) and under any current contractual duty.
5. Open an internal incident record (date, systems, timeline, decisions).

## Log retention checklist

- [ ] Cloudflare Workers / Logpush retention ≥ 180 days or export pipeline to Indian storage
- [ ] D1 backup / export schedule documented
- [ ] Application does not log raw patient tokens, phone numbers, or full conversations (use `src/redact.js`)
- [ ] Time synchronisation (UTC) confirmed on platform

## DPDP parallel (from 13 May 2027)

In addition to CERT-In:
- Intimate Data Protection Board without delay and detailed follow-up within 72 hours (Rule 7)
- Notify affected Data Principals without delay where required

## Contacts (clinic / operator to complete)

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Technical lead |  |  |  |
| Clinic Data Fiduciary contact |  |  |  |
| Legal / compliance |  |  |  |
