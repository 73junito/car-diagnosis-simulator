# AutoLearnPro — Research Validation and Institutional Adoption Plan (v1.0)

**Status:** proposed implementation program, not a claim of validated learning effectiveness, institutional approval, degree accreditation, or assessment eligibility. **Product stance:** research-driven, under staged validation. **Default:** all DCAF scores formative-only, instructor-reviewed, and disabled for credential, grade, admission, or assessment-gating decisions until separately authorized.

## Goal and accountable outcomes

Teach automotive diagnosis as an evidence-based process and measure whether learners can perform it reliably, including transfer from simulation to a supervised vehicle/lab task. Adoption means an instructor can assign, supervise, review, and export evidence through an accessible, privacy-reviewed workflow. Scientific validation and adoption must progress together; neither is presumed because the platform is deployable.

**Owners (roles, not named appointments):** academic program sponsor (scope/go-no-go); automotive subject-matter lead (fault truth and rubric); research methods lead (protocol and analysis); instructor pilot lead (operations); privacy/security lead (data and agreements); engineering lead (event integrity/accessibility). A gate requires documented signatures/decisions from relevant owners. No institutional endorsement is presumed.

## Delivery stages and exit gates

| Stage | Build | Evidence needed to exit | Decision |
|---|---|---|---|
| R0: governance | DCAF constructs, rubric, scenarios, data dictionary, risks, roles and research plan | SME review and documented approval; intended uses and prohibited uses; privacy/retention specification | Approve formative prototype only |
| R1: technical fidelity | One AUT-250 cylinder-misfire scenario, instrument state and reproducible fault truth | Scenario replay consistency, plausible scan-tool/measurement responses reviewed by ≥2 qualified technicians, accessibility and safety review | Permit internal instructor trials |
| R2: scoring reliability | Versioned event trail, independent human scoring, adjudication and audit | Predefined agreement statistics with confidence intervals, discrepancy review, rubric revision log | Permit supervised formative pilot if thresholds met |
| R3: educational validity | Preregistered pilot comparing simulated skill with blinded supervised hands-on performance | Documented sample/recruitment, outcome measures, limitations, missingness and adverse events; no unapproved causal claims | Decide whether expanded validation is warranted |
| R4: institutional pilot | Course mapping, instructor oversight, supported LMS export/integration, SSO/privacy/accessibility, support | Institution signs pilot agreement and data-use terms; instructor UAT; FERPA/records and accommodation review as applicable | Limited institutional deployment |
| R5: replication/adoption | Multi-cohort/multi-site confirmation, sustainability, accessibility testing | Independent replication and institution-specific acceptance; transparent evidence report | Consider broader adoption; high-stakes use needs separate validation |

**Gate controls:** no stage advances automatically; ambiguous or missing evidence is `not_verified`. Prior platform readiness and KBOR communication are not substitutes for a local institutional determination. Do not describe catalog pathways as accredited programs.

## DCAF v1.0: constructs and illustrative rubric

1. Diagnostic plan and hypothesis refinement — 25 points: interprets complaint/context, selects a sensible sequence, updates hypotheses when new evidence appears.
2. Test selection and measurement interpretation — 25 points: chooses discriminating tests, sets instruments appropriately, records expected versus measured values.
3. Evidence-based technical reasoning — 20 points: supports/contradicts candidate causes, distinguishes correlation from evidence.
4. Safety and procedural integrity — 10 points: respects safe procedures and simulation prerequisites; critical violations reported separately and reviewed by instructor.
5. Verification of repair — 10 points: demonstrates return to expected behavior across original operating conditions.
6. Documentation/communication — 10 points: clear chronology, numerical measurements with units, diagnosis and uncertainty.

Weights are design hypotheses, **not psychometrically validated**. Score each dimension with an anchored 0–4 descriptor rubric (0 missing/unsafe, 1 unsupported, 2 incomplete, 3 competent with evidence, 4 independently reproducible justification), normalized to the dimension weight. Preserve raw evidence, rubric version, assessor, overrides, disagreements, and scoring rationale. Do not count clicks, speed, tool count, or final repair alone as competence. A different technically sound sequence may earn the same score. Instructor overrides are auditable and do not overwrite original events.

## Research protocol and measurement quality

- **Question:** Does performance in a validated diagnostic simulation relate to independently rated real-lab diagnostic skill, and does a defined instructional intervention improve skill relative to a suitable comparison?
- **Design:** start with prospective feasibility and blinded inter-rater reliability; then preregister a controlled comparison where ethically and operationally feasible. Randomize if practical, otherwise acknowledge selection bias. Separate development, calibration and confirmatory cohorts; avoid students being scored on practice cases identical to assessment cases.
- **Primary outcomes:** process-quality rubric score on **unseen real-lab tasks** rated by blinded assessors; inter-rater reliability for independently scored artifacts. Secondary outcomes: technical knowledge, retention, time/cost, instructor workload, accessibility, completion and adverse events.
- **Analysis plan:** select ICC model appropriate to score and raters, report confidence intervals and absolute-agreement estimates; report weighted kappa for ordinal indicators; assess transfer through preregistered association/comparison with uncertainty. Set numerical success thresholds and power/sample size **before** testing with the methods lead—do not invent results or treat arbitrary thresholds as accepted standards. Track subgroup fairness only with approval and sufficient privacy safeguards.
- **Validity threats:** memorized cases, interface familiarity, reading load, differential instructor support, baseline knowledge, simulator fidelity, grading drift and missing-data bias. Record deviations and version changes.
- **Ethics:** obtain institutional human-subjects/IRB determination **before research recruitment or collecting research data**; obtain appropriate consent/notice and pilot data-use agreements. Course participation, research participation, and grades must remain separable. No protected data in public CI artifacts; pseudonymize and restrict access to raw events; establish retention, deletion, breach response and FERPA responsibilities before pilots.

## Institutional readiness acceptance

Document instructor onboarding/UAT, LMS/gradebook integration expectations (e.g. LTI 1.3 when prioritized), accessibility testing against relevant WCAG standards, accommodations, role-based permissions, export and deletion policy, uptime/support boundaries, versioned curriculum/assessment mapping, academic integrity, pricing/procurement and incident response. An exported evidence report must show scenario version, observable actions, measurements, assessor decisions, rubric version, consent/use policy and unresolved uncertainties. Student-facing explanations must not claim AI scoring has been validated.

## Sequencing and change control

**First implementation slice:** author machine-checkable milestone register and fail-closed governance checks; then one AUT-250 misfire scenario with event telemetry behind an opt-in development flag; instructor double-scoring and calibration; supervised pilot only after gate approvals. Each later PR must include an Educational Impact Review: competency, measurable behavior, evidence source, educational claim level, instructor review path, safety/privacy status, test coverage, assessment eligibility impact and rollback plan. Existing eligibility restrictions are unchanged by this document.

**Publication rule:** distinguish research-driven, under evaluation, and validated-for-specific-use. Report null/negative outcomes and limitations. Institutional agreements/IRB determinations and reliable outcome evidence precede claims of scientific validation or institutional approval.
