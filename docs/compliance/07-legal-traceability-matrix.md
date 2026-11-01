# Legal-to-control-to-test traceability (India)

**Version:** 1.0 — 1 November 2026  
**Status:** Engineering planning matrix; legal applicability and role allocation require review by Indian counsel.  
**This is not a certificate, legal opinion or assertion that every provision is already in force.**

## 1. DPDP Act, 2023 — phased commencement

Gazette notification G.S.R. 843(E), 13 November 2025, appoints three commencement groups:

- **13 November 2025:** definitions and institutional / procedural provisions listed in the notification.
- **13 November 2026:** section 6(9) (Consent Manager registration-related provision) and section 27(1)(d).
- **13 May 2027:** the main processing provisions listed in paragraph (c), including sections 3–5, section 6(1)–(8) and (10), sections 7–17, most of section 27, sections 28–34, 36, 37 and section 44(2).

The DPDP Rules, 2025 have a corresponding phased schedule under Rule 1(2): Rules 1, 2 and 17–21 from publication; Rule 4 after one year; Rules 3, 5–16, 22 and 23 after eighteen months. Check the current Gazette text and corrigenda before release. Do not assume the main obligations became enforceable on notification day.

Official sources:
- Act: https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf
- Rules: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf
- Commencement notification: https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf
- MeitY rules and corrigenda index: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa

## 2. Requirement traceability

| Requirement | Legal reference / commencement | Engineering / operational control | Evidence and acceptance test | Owner |
|---|---|---|---|---|
| Lawful processing and purpose limitation | DPDP Act ss. 3–5; 13 May 2027 | Inventory each field, purpose, data subject, recipient and lawful basis; minimise collection | Approved data inventory; negative test for unapproved fields/purposes | Clinic/Data Fiduciary + operator |
| Clear notice | DPDP Act s. 5; DPDP Rules r. 3; 13 May 2027 | Standalone plain-language notice with purposes, data, rights/contact and withdrawal route | Versioned notice; language review; test notice before collection | Clinic |
| Consent and withdrawal | DPDP Act s. 6(1)–(8),(10); 13 May 2027 | Purpose-specific affirmative choice; proof; withdrawal; stop further consent-based processing | Append-only grant/withdrawal; stale-version and post-withdrawal tests | Clinic + engineering |
| Consent Manager | DPDP Act s. 6(9), r. 4; 13 November 2026 | Applies if the product/operator offers a regulated Consent Manager service; ordinary clinic consent UI is not itself a Consent Manager | Written applicability decision; do not market as Consent Manager absent registration | Legal/operator |
| Data Fiduciary accountability / processors | DPDP Act s. 8; 13 May 2027 | Written processor terms; documented instructions; subprocessor control; data quality; security | Signed DPA/processor clauses; vendor register; processor test evidence | Clinic + operator |
| Security safeguards | DPDP Act s. 8(5); DPDP Rules r. 6; 13 May 2027 | Encryption/masking, access control, logs/monitoring/review, backups, security contracts and organisational measures | Config evidence, access reviews, log tests, backup restore, security assessment | Clinic + processor |
| Breach response | DPDP Act s. 8(6); DPDP Rules r. 7; 13 May 2027 | Notify affected Data Principals without delay; Board intimation without delay and detailed follow-up within 72 hours under Rule 7 | Incident register, templates, tabletop, timestamped decision/report evidence | Data Fiduciary |
| Erasure and retention | DPDP Act s. 8(7), r. 8 and applicable schedules; 13 May 2027 | Retention schedule, erasure after purpose ends unless legal retention, processor/backups deletion | Deletion propagation test; backup restore/tombstone test; legal-hold record | Clinic + processors |
| Data Principal rights | DPDP Act ss. 11–14; Rules 13–15 as applicable; 13 May 2027 | Access, correction/update, erasure, grievance, nomination and authorised representative workflows | Case register, identity/authority verification, fulfilment evidence and deadlines | Clinic |
| Children's data | DPDP Act s. 9; 13 May 2027 | Determine age handling; implement applicable verifiable parental consent and restrictions before processing children's data | Minor test cases and approved parental workflow | Clinic + operator |
| Cross-border processing | DPDP Act s. 16; 13 May 2027 | Map regions, subprocessors and transfer destinations; apply government restrictions and other sectoral obligations | Vendor/region register and legal review | Operator + clinic |
| Penalties / enforcement readiness | DPDP Act ss. 28–34; 13 May 2027 | Governance, accountable owner, remediation and evidence | Approved compliance review and closure register | Data Fiduciary |

## 3. IT Act and related rules/directions

| Requirement | Reference | Control / evidence |
|---|---|---|
| Sensitive personal data (including medical records/history/physical or mental health information) | IT Act 2000 s. 43A and SPDI Rules 2011, subject to transitional repeal/applicability analysis | Privacy policy, consent/collection controls where required, purpose limitation, disclosure/transfer controls, reasonable security practices, grievance officer/contact |
| Reasonable security practices | SPDI Rules 2011 r. 8 | Documented information security programme and controls; ISO/IEC 27001 is a recognised route, not an automatic universal certification requirement |
| Grievance officer | SPDI Rules 2011 r. 5(9) | Publish named role/contact and handle grievances within prescribed timeframe; verify current text and applicability |
| Cyber-incident reporting | CERT-In Directions under IT Act s. 70B(6), 28 April 2022 | Assess specified incidents; reporting within six hours of noticing/being brought to notice; retain logs securely for rolling 180 days within India; designate point of contact where applicable |
| DPDP transition | DPDP Act s. 44(2) commencement group | Section 44(2) is in the 18-month group; obtain counsel's advice on SPDI / s. 43A transition and avoid assuming it is already repealed on 1 Nov 2026 |

Official CERT-In source: https://www.cert-in.org.in/Directions70B.jsp

## 4. Product-specific mapping

### MediLoop
- Clinic patient records, registration, consultation, prescriptions and patient communications are clinic-directed processing.
- MediLoop's current consent/rights evidence is embedded in mutable patient records; it is not yet an immutable server-side ledger or complete rights case-management workflow.
- Current clinic storage uses Redis/Upstash as documented; browser localStorage/cache and exports are also in scope.
- The clinic is the presumed Data Fiduciary for care purposes, subject to actual contracts and conduct.

### AI Clinical Screening
- Screening sessions, conversations, outputs and consent events are stored in the separate D1 database.
- Consent ledger and server-side active-consent checks exist in source; HTTP/D1 concurrency and deployment tests remain required.
- The consent-evidence migration 0002 is present but not applied; production migration requires separate backup, review and approval.
- MediLoop and the clinic need processor instructions and a documented deletion/rights-request route.

## 5. Explicitly not equivalent to compliance

- A checkbox alone is not a complete consent system.
- A consent ledger alone is not a full privacy programme.
- A generated ROPA-style export is not proof that the inventory is complete.
- A breach draft is not a reporting process.
- A local privacy notice is not a signed processor agreement.
- Passing unit tests does not establish deployed configuration, vendor or organisational compliance.
- ABDM alignment is separate and does not follow automatically from DPDP/IT Act work.
