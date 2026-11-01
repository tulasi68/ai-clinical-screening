# Phase 2 — Patient privacy notice and screening consent

**Status:** Draft content and implementation acceptance criteria. Clinic/legal approval and UI wiring required before publication.

## 1. Notice content required before data collection

Identify the clinic/Data Fiduciary and contact; list patient data categories; describe the specific screening purpose; identify MediLoop, Screening and approved hosting/messaging/AI processors; explain whether screening is optional and the consequence of declining; explain withdrawal; publish rights and grievance routes; and state retention details or how to obtain them.

## 2. Draft patient-facing screening notice

> **Who is responsible?** [Clinic legal name] is responsible for the patient-care purpose for which this screening is requested. Contact: [clinic privacy/grievance contact].
>
> **What this service collects:** your name, age, gender, contact number, symptoms and answers to screening questions, together with the screening session and related technical information.
>
> **Why:** to collect information before your consultation and share the resulting screening summary with the clinic's authorised care team. This service does not make a diagnosis or replace the treating clinician.
>
> **Who processes it:** [MediLoop legal entity] coordinates the clinic workflow; [Screening operator legal entity] provides this screening service; [Cloudflare and any other approved providers] host or support the service. Complete this list from the vendor register before publication.
>
> **Your choice:** screening is [optional / required for the specific clinic workflow—clinic must choose and justify]. You can decline and contact the clinic for an alternative. If you grant consent, you may withdraw it using the withdrawal control or [contact]. Withdrawal stops further screening processing where applicable; it does not automatically erase information already lawfully processed or clinical records the clinic must retain.
>
> **Your requests:** contact [clinic privacy/grievance contact] for access, correction, erasure where applicable, consent withdrawal or a grievance.
>
> **Retention:** [clinic-approved retention period and basis]. Contact [clinic] for details.
>
> Notice version: [version/date]. Language: [language].

## 3. Consent event requirements

The D1 consent ledger records purpose, notice version, server timestamp, language, method, channel, actor type and evidence JSON. Keep the evidence minimal. Do not put symptoms, conversation text or full identity data into `evidence_json`.

Required behavior:
- No start, answer, summary edit or submission without active consent for the current purpose/version.
- A fresh affirmative choice for a new or materially changed notice.
- Withdrawal adds a new event and blocks further screening actions.
- Consent state is checked server-side, not trusted from browser state.
- Notice is accessible again during the session.
- Patient can decline screening and use the clinic's alternative process.

## 4. Current gap

The service already has a server-timestamped append-only D1 consent event ledger and active-consent gates. However, the complete clinic-specific notice, named responsible entity/contact, full vendor disclosures, translations, retention details and end-to-end tested withdrawal workflow remain outstanding. The ledger's `evidence_json` must be reviewed for minimisation and retention.

## 5. Acceptance criteria

Test missing consent, declined consent, wrong notice version, stale grant, withdrawal, replay, concurrent message/withdrawal and post-withdrawal output access through actual HTTP routes and D1. Do not rely solely on helper tests.
