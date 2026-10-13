# Curriculum Reference Quality Audit

**Audit date:** 2026-10-09  
**Repository:** 73junito/car-diagnosis-simulator  
**Audited main SHA:** `564a8645b49958f52bfbbfb3f4571cf6c5471dc5`  
**Production app version:** `564a8645b49958f52bfbbfb3f4571cf6c5471dc5`

## Purpose

This audit distinguishes **reference coverage completeness** from **institution-ready source quality**. A lesson counts as covered when it has at least one governed reference mapping, but that metric alone does not establish that the mapped reference is a complete automotive technical authority for the lesson.

No evidence approvals, assessment-eligibility decisions, AI/RAG ingestion permissions, or production configuration are changed by this audit.

## Verified production baseline

- 64 of 64 lesson plans have at least one governed reference mapping.
- Undergraduate coverage: 43/43 (100%).
- Graduate coverage: 21/21 (100%).
- Production reference inventory: 15 sources and 76 mappings.
- Every production mapping resolves to an existing lesson and existing reference source.
- All 15 API-exposed reference records include a canonical URL, a license classification, and explicit booleans for citation/linking, paraphrase/summary, direct reproduction, database storage, AI/RAG ingestion, and commercial use.
- No zero-reference lesson remains.

The public reference API intentionally does not expose internal `status` or `rights_basis` fields, so those fields are not treated as missing merely because they are absent from the API response.

## Rights-metadata spot checks

The current conservative controls are directionally correct:

- OpenStax records are classified as `CC_BY_NC_SA_4_0`; production disables paraphrase/summary, direct reproduction, database storage, AI/RAG ingestion, and commercial use while retaining citation/linking.
- Open Oregon's *Open Curriculum Development Model* and *Technical Writing for Technicians* are recorded as CC BY 4.0 with reuse enabled subject to attribution.
- The IES continuous-improvement toolkit remains citation-only pending independent reuse-rights confirmation.
- NASA, NHTSA, OSHA, and EPA references use federal-government/public-domain classifications with third-party caveats and intentionally conservative storage/RAG controls.

These controls should remain fail-closed unless a source-level rights review explicitly expands them.

## Qualitative finding: coverage concentration

Reference coverage is complete, but it is highly concentrated.

- **53 of 64 lessons (82.8%) are single-source lessons.**
- **19 of 21 graduate lessons (90.5%) are single-source lessons.**
- **34 of 43 undergraduate lessons (79.1%) are single-source lessons.**
- Only 11 lessons have two or more distinct mapped sources.

The most reused sources are:

| Source | Lessons mapped | Primary subject |
| --- | ---: | --- |
| OpenStax Principles of Data Science | 15 | data science |
| OpenStax University Physics, Volume 1 | 15 | physics |
| Technical Writing for Technicians | 13 | technical communication |
| OpenStax Introduction to Computer Science | 10 | computer science |
| Fiore AC Electrical Circuit Analysis | 5 | electrical engineering technology |
| OpenStax Chemistry 2e | 4 | chemistry |
| NHTSA Electric and Hybrid Vehicle Safety | 3 | electric-vehicle safety |

This is acceptable for foundational support but creates a **coverage-only risk** when a broad foundational source is the only reference for a specialized automotive lesson.

## High-priority supplemental-authority candidates

The following lessons are covered, but their only mapped reference is a broad foundation, method, or adjacent-domain source rather than an automotive-specific technical authority. They should not be treated as institution-ready solely because the coverage metric is green.

### Undergraduate

| Lesson | Current single-source role | Quality concern |
| --- | --- | --- |
| `ug-electrical-charging-system` | `stem-foundation` | Physics foundation does not substitute for charging-system service/diagnostic authority. |
| `ug-brakes-foundations` | `engineering-mechanics-foundation` | Mechanics foundation does not provide brake-system inspection, service, or diagnostic procedures. |
| `ug-suspension-steering-foundations` | `engineering-mechanics-foundation` | General mechanics does not provide steering/suspension service specifications or procedures. |
| `ug-aut130-engine-systems` | `physics-foundation` | General physics supports principles but not engine construction/service authority. |
| `ug-aut160-drivetrain-systems` | `engineering-mechanics-foundation` | General mechanics is not drivetrain service information. |
| `ug-aut170-hvac-systems` | `chemistry-foundation` | Chemistry supports refrigeration concepts but not automotive HVAC service procedures or refrigerant compliance. |
| `ug-aut220-automatic-transmissions` | `engineering-mechanics-foundation` | General mechanics does not cover transmission diagnosis/service specifications. |
| `ug-aut250-automotive-diagnostics-i` | `diagnostic-data-foundation` | Data-science methods do not substitute for automotive diagnostic procedures and system specifications. |
| `ug-aut270-emissions-systems` | `chemistry-foundation` | Chemistry alone does not provide emissions-system operation, regulatory context, or diagnostics. |
| `ug-aut310-network-communications` | `computing-foundation` | General computer science is insufficient for CAN/LIN/vehicle-network technical authority. |
| `ug-aut320-hybrid-vehicle-technology` | `energy-systems-foundation` | Physics supports energy concepts but not HEV architecture/service authority. |
| `ug-aut340-battery-management` | `electrochemistry-foundation` | Chemistry supports battery principles but not BMS diagnostics, algorithms, or vehicle-specific service information. |
| `ug-aut350-adas` | `data-analysis-foundation` | Data science is not a calibration, sensor, or ADAS service authority. |
| `ug-aut380-cybersecurity` | `computing-foundation` | General CS does not provide automotive cybersecurity standards or vehicle-specific threat models. |
| `ug-aut390-connected-sdv` | `computing-foundation` | General CS does not provide automotive SDV architecture/lifecycle authority. |

### Graduate

| Lesson | Current single-source role | Quality concern |
| --- | --- | --- |
| `grad-aut501-integrated-systems` | `systems-integration-foundation` | NASA systems engineering is methodologically strong but not automotive domain authority. |
| `grad-aut530-advanced-ev-systems` | `energy-systems-foundation` | Physics is insufficient as the sole advanced-EV architecture reference. |
| `grad-aut535-battery-systems` | `electrochemistry-foundation` | Chemistry is insufficient for state estimation, modeling, and BMS diagnostics at graduate depth. |
| `grad-aut540-power-electronics` | `electrical-theory-reference` | Circuit analysis supports theory but not automotive inverter/converter architecture and validation. |
| `grad-aut550-automotive-networks` | `computing-foundation` | General computer science is not a vehicle-network standards authority. |
| `grad-aut560-adas-perception` | `data-analysis-foundation` | Data science alone is insufficient for sensor fusion/perception validation. |
| `grad-aut565-autonomous-systems` | `data-analysis-foundation` | Data science alone is insufficient for autonomous architecture, planning, control, and safety validation. |
| `grad-aut570-cybersecurity` | `computing-foundation` | Automotive cybersecurity requires automotive-specific standards and threat-model references. |
| `grad-aut575-software-defined-vehicle` | `computing-foundation` | General CS alone is too broad for SDV platforms and lifecycle architecture. |
| `grad-aut580-control-systems` | `electrical-theory-reference` | Circuit theory alone is insufficient for advanced control, estimation, and stability. |
| `grad-aut585-digital-twins` | `data-modeling-foundation` | Data-science foundations do not by themselves establish digital-twin engineering authority. |
| `grad-vehicle-systems-testing` | `testing-data-foundation` | Data-science methods are not a substitute for vehicle test standards, instrumentation, and validation practice. |

## Findings by gate

| Gate | Result | Notes |
| --- | --- | --- |
| Coverage completeness | PASS | 64/64 lessons covered. |
| Mapping referential integrity | PASS | No missing lesson/source references found. |
| API-exposed rights metadata completeness | PASS | All key rights booleans are explicit. |
| Conservative AI/RAG rights posture | PASS | Restricted sources remain non-ingestible. |
| Source-role naming/scoping | PASS | Roles describe foundational/supporting intent rather than claiming unsupported authority. |
| Source diversity | NEEDS WORK | 53/64 lessons rely on one source. |
| Automotive-domain authority | NEEDS WORK | Multiple specialized lessons rely only on broad foundational sources. |
| Institution-ready reference quality | NOT YET | Quantitative coverage is complete; qualitative technical-authority supplementation remains. |

## Recommended next implementation batch

Do **not** reopen coverage as a numeric problem. Keep 64/64 coverage intact and create a supplemental-authority backlog.

Priority order:

1. Safety-critical and service-critical undergraduate domains: brakes, steering/suspension, charging/electrical, HVAC, drivetrain/transmission, emissions, HEV/EV.
2. Automotive networks, cybersecurity, ADAS, and software-defined-vehicle domains.
3. Graduate advanced EV, battery/BMS, power electronics, controls, perception/autonomy, digital twins, and vehicle testing.
4. For each new source, preserve the existing rights-governance model: source-specific license classification, explicit citation/reuse/storage/RAG/commercial booleans, attribution requirements, and narrowly scoped mapping roles.
5. A supplemental authority must improve technical fit; adding a second generic source only to increase source count does not close a quality finding.

## Audit conclusion

**Reference coverage is complete. Reference quality is not yet institution-ready across all 64 lessons.**

The 100% coverage result should be reported as **quantitative reference coverage**, not as proof that every lesson has sufficient automotive technical authority. The next milestone is to supplement the identified coverage-only mappings with authoritative automotive, standards, manufacturer, government, or peer-reviewed technical sources while preserving current licensing and assessment-governance boundaries.
