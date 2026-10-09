# AutoLearn Pro Education Privacy & AI Control Matrix

Status: Draft governance baseline
Scope: Federal + Kansas baseline with implemented California, Illinois, and Texas privacy/AI overlays.
Implementation posture: documentation/governance only in this PR. No runtime behavior, assessment eligibility, authentication, analytics, or data-retention behavior is changed by this document.

## Purpose

This matrix translates education-privacy and AI-related legal requirements into product controls that can later be implemented and tested in small, auditable changes.

It is an engineering/compliance planning artifact, not legal advice. Applicability can depend on customer type, student age, data flows, contractual role, and deployment context.

## Product invariants

1. Student information is collected and used only for documented educational/product purposes.
2. Student data is not sold or rented.
3. Student-derived data is not used for targeted advertising.
4. Institution-provided education-record data is not repurposed for unrelated commercial uses.
5. AI remains advisory for instruction and diagnostic reasoning; it does not independently determine admission, discipline, credential eligibility, employment, or other consequential status.
6. Biometric identification is disabled by default and should not be introduced without a separately approved legal, privacy, security, and accessibility review.
7. AI/model training on identifiable institution-provided student records is disabled by default.
8. Service-provider access to student data must be purpose-limited, contractually restricted, and security-controlled.
9. Deletion, export, retention, and incident-response capabilities must support institutional obligations.
10. Jurisdiction-specific requirements should be implemented as policy/configuration controls rather than maintaining separate product forks.

## Federal baseline

| Control ID | Authority | Product control | Initial status |
| --- | --- | --- | --- |
| FED-FERPA-01 | FERPA school-official exception | Institution-supplied education-record PII may be processed only for the disclosed institutional service/function and under institution control. | Required |
| FED-FERPA-02 | FERPA redisclosure/purpose limits | Prevent secondary use or redisclosure of education-record PII except as authorized by law/contract. | Required |
| FED-FERPA-03 | FERPA vendor governance | Maintain institution-facing contract terms covering permitted use, access, security, deletion/return, and subprocessors. | Required |
| FED-COPPA-01 | COPPA | Support an under-13 deployment mode that does not rely on school consent for unrelated commercial purposes. | Required before under-13 use |
| FED-COPPA-02 | COPPA | Provide school/parent-facing notice of child-data collection, use, and disclosure where COPPA applies. | Required before under-13 use |
| FED-COPPA-03 | COPPA | Support review/deletion and cessation of further collection when required. | Required before under-13 use |
| FED-PPRA-01 | PPRA | Do not introduce protected-information surveys or sensitive nonacademic questionnaires without an institutional consent/notice workflow. | Guardrail |
| FED-PPRA-02 | PPRA | Keep marketing-related data collection from students disabled by default. | Required |

### Federal implementation notes

FERPA permits schools to use contractors under the school-official exception when the contractor performs an institutional service/function, is under the institution's direct control for use and maintenance of education records, and is subject to purpose and redisclosure limits.

COPPA school consent is limited to collection for the use and benefit of the school and for no other commercial purpose. If AutoLearn Pro later serves children under 13, age-aware consent, notice, review, deletion, and purpose controls must be implemented before deployment.

PPRA can apply to federally funded education programs and covers protected-information surveys, marketing-related collection, and certain examinations. AutoLearn Pro should therefore require explicit review before adding nonacademic surveys or physiological/emotional-state assessment features.

## Kansas baseline

Kansas is a first-tier jurisdiction for AutoLearn Pro because state law expressly regulates educational online products and student information.

| Control ID | Kansas authority | Product control | Initial status |
| --- | --- | --- | --- |
| KS-SOPPA-01 | K.S.A. 72-6332 | Treat AutoLearn Pro as potentially within the definition of an educational online product/operator when marketed and used primarily for educational purposes. | Baseline assumption |
| KS-SOPPA-02 | K.S.A. 72-6333(a)(1) | No targeted advertising based on student information or persistent identifiers obtained through educational use. | Required |
| KS-SOPPA-03 | K.S.A. 72-6333(a)(2) | Do not build noneducational student profiles from educational-use data. | Required |
| KS-SOPPA-04 | K.S.A. 72-6333(a)(3) | Do not sell or rent student information. | Required |
| KS-SOPPA-05 | K.S.A. 72-6333(a)(4)(E) | Subprocessors receiving student information must be contractually purpose-limited, barred from onward disclosure, and required to maintain reasonable security. | Required |
| KS-SOPPA-06 | K.S.A. 72-6333(b)(1) | Maintain reasonable security procedures appropriate to the nature of student information. | Required |
| KS-SOPPA-07 | K.S.A. 72-6333(b)(2) | Support deletion within a reasonable period after a school-district request unless the student/parent requests continued maintenance. | Required |
| KS-SOPPA-08 | K.S.A. 72-6333(c) | Product improvement may use student information only within statutory boundaries; de-identified improvement data must not remain associated with an identified student. | Required |
| KS-BIO-01 | K.S.A. 72-6315 | Do not collect student biometric data or assess physiological/emotional state for Kansas school deployments without the legally required written consent workflow. | Disabled by default |
| KS-BREACH-01 | K.S.A. 72-6318 | Incident-response design must support immediate notification to affected adult students or parents/guardians of minors after covered breach/unauthorized disclosure. | Required |

## Kansas data classification trigger

Kansas's educational-online-product definition of personally identifiable information is broad and includes, among other categories, test results, grades, evaluations, biometric information, disabilities, search activity, photos, voice recordings, and geolocation.

Accordingly, AutoLearn Pro should classify the following as student_restricted unless a more restrictive class applies:

- assessment attempts, scores, grades, and evaluation records;
- institution identifiers and roster data;
- student-authored diagnostic notes and submitted documents when linked to a student;
- photos or voice recordings linked to a student;
- precise geolocation, if ever collected;
- disability/accommodation information;
- biometric templates or identifiers, if ever approved for collection;
- search/activity history when associated with an identified student.

## AI control matrix

| AI capability | Default | Governance rule |
| --- | --- | --- |
| AI tutoring/explanations | Allowed | Must remain instructional/advisory and disclose AI involvement where appropriate. |
| AI diagnostic reasoning assistance | Allowed | Must require learner/technician verification; cannot become assessment evidence merely because AI produced it. |
| AI-generated feedback | Allowed | Must not independently impose discipline, credential status, admission, or employment outcomes. |
| AI scoring suggestions | Restricted | Human/institution-defined scoring authority must remain controlling. |
| AI pass/fail or credential eligibility | Disabled | Requires separate legal, academic-governance, fairness, and appeal review before any implementation. |
| AI employment ranking/screening | Disabled | Outside current product scope; requires separate employment-law review. |
| AI emotion inference | Disabled | High privacy/biometric risk; Kansas consent issues can be triggered in school use. |
| Face recognition / face templates | Disabled | Requires separate biometric-law review and explicit approval. |
| Voiceprint identification | Disabled | Ordinary audio input must not silently become biometric identification. |
| Model training on identifiable student records | Disabled | Requires separate legal basis, institution approval, data-governance review, and technical controls. |
| RAG over institution-approved course content | Allowed if source/data rights permit | Must remain segregated from student-record training and follow existing source-rights governance. |

## Required implementation backlog

### P0 — governance before institutional expansion

- Add a formal student-data inventory: field, purpose, source, retention, storage location, recipient/subprocessor, jurisdictional sensitivity.
- Add a subprocessor register and contract-control checklist.
- Define student_restricted, institution_record, minor_data, biometric, and sensitive_survey classifications.
- Add an institution-configurable retention/deletion contract.
- Add an incident-response runbook with Kansas immediate-notification handling.
- Add explicit policy that targeted advertising and sale/rental of student data are prohibited.
- Add explicit policy that identifiable institution student data is not used for general model training by default.

### P1 — age and consent controls

- Add tenant/student age-band configuration: adult/postsecondary, minor 13-17, under 13.
- Add COPPA school/parent notice and consent-state support before under-13 deployment.
- Add protected-survey review/approval metadata before any PPRA-sensitive survey feature.
- Add a hard feature flag preventing biometric identification and physiological/emotional inference.

### P2 — institution controls

- Institution admin export of covered student records.
- Institution admin deletion request workflow with auditable completion.
- Subprocessor/data-sharing disclosure view.
- Retention-policy configuration and deletion job evidence.
- Data-access audit trail for privileged student-record access.

## State expansion roadmap

These are research/implementation queues, not a conclusion that every listed law applies to every deployment.

| Jurisdiction | Primary trigger to evaluate | Current planning posture |
| --- | --- | --- |
| California | CCPA/CPRA + final CPPA risk-assessment/ADMT regulations | Applicability remains threshold- and processing-dependent. Regulations are effective Jan. 1, 2026; significant-decision ADMT compliance begins Jan. 1, 2027. Consequential AI remains disabled. |
| Illinois | BIPA, 740 ILCS 14 | Biometric identification remains disabled. If BIPA-covered biometrics are ever collected, written release/notice and public retention-destruction policy controls must be implemented first. |
| Texas | Business & Commerce Code Ch. 503 + TRAIGA | Commercial biometric capture requires notice/consent under Ch. 503. TRAIGA is effective Jan. 1, 2026; do not misstate its disclosure rule as a general private educational chatbot requirement. |
| Washington | Biometric identifiers + My Health My Data | Keep biometric identification disabled; avoid collecting health/physiological inference unless separately approved. |
| Colorado | ADMT consequential decisions + chatbot safety | Track 2026 rulemaking; new ADMT provisions effective Jan. 1, 2027. |

## Decision gates for future PRs

A feature PR must receive a compliance review before merge if it introduces any of the following:

- new student PII fields;
- a new subprocessor or external AI provider receiving student data;
- advertising, marketing, profiling, or cross-context behavioral tracking;
- biometric capture, templates, recognition, or voiceprints;
- health, disability, physiological, emotional, or mental-state inference;
- under-13 users;
- automated scoring that materially affects a student's status;
- automated decisions concerning admission, discipline, credentials, employment, financial aid, or similar consequential outcomes;
- new retention periods or deletion exceptions;
- new use of student records for model training, fine-tuning, embeddings, or RAG.

## Official source register

### Federal

- FERPA school-official contractor guidance: https://studentprivacy.ed.gov/faq/who-school-official-under-ferpa
- FERPA tutoring/vendor example: https://studentprivacy.ed.gov/faq/can-schools-disclose-education-records-community-based-organizations-performing-outsourced
- COPPA education FAQs: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- PPRA overview: https://studentprivacy.ed.gov/topic/protection-pupil-rights-amendment-ppra

### Kansas

- Article 63 student records index: https://www.kslegislature.gov/b2025_26/laws/072_000_0000_chapter/072_063_0000_article/
- K.S.A. 72-6313 definitions: https://kslegislature.gov/b2025_26/laws/072_000_0000_chapter/072_063_0000_article/072_063_0013_section/072_063_0013_k/
- K.S.A. 72-6315 biometric collection: https://www.kslegislature.gov/b2025_26/laws/072_000_0000_chapter/072_063_0000_article/072_063_0015_section/072_063_0015_k/
- K.S.A. 72-6318 breach/unauthorized disclosure: https://www.kslegislature.gov/b2025_26/laws/072_000_0000_chapter/072_063_0000_article/072_063_0018_section/072_063_0018_k/
- K.S.A. 72-6332 definitions: https://www.kslegislature.gov/b2025_26/laws/072_000_0000_chapter/072_063_0000_article/072_063_0032_section/072_063_0032_k/
- K.S.A. 72-6333 operator controls: https://www.kslegislature.gov/b2025_26/laws/072_000_0000_chapter/072_063_0000_article/072_063_0033_section/072_063_0033_k/
- K.S.A. 72-6334 enforcement: https://kslegislature.gov/b2025_26/laws/072_000_0000_chapter/072_063_0000_article/072_063_0034_section/072_063_0034_k/

### State expansion sources

- California CPPA regulations: https://cppa.ca.gov/regulations/ccpa_updates.html
- Illinois BIPA definitions: https://www.ilga.gov/legislation/ilcs/fulltext?DocName=074000140K10
- Illinois BIPA private action: https://www.ilga.gov/legislation/ilcs/fulltext?DocName=074000140K20
- Texas biometric identifiers: https://statutes.capitol.texas.gov/Docs/BC/pdf/BC.503.pdf
- Texas TRAIGA consumer overview: https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-ai-rights
- Washington biometric identifiers: https://app.leg.wa.gov/RCW/default.aspx?cite=19.375
- Washington My Health My Data: https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy
- Colorado ADMT rulemaking: https://coag.gov/ai/

## Review cadence

Review this matrix at least quarterly, and before any launch into a new institutional market, student age band, jurisdiction, or materially new AI/data-processing capability.

Last legal-source verification: 2026-10-09.
