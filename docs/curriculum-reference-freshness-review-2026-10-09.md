# Curriculum Reference Freshness Review

**Review date:** 2026-10-09  
**Scope:** Five technical sources flagged by the deterministic >=10-year age screen after the curriculum reference-quality audit reached 64/64 strong lessons.

## Purpose

This review distinguishes **source age** from **source currency**. An older publication is not automatically stale. Each flagged source was checked against its current publisher, regulator, standards, or DOI landing page and given a disposition that preserves its intended instructional role.

This review does **not** change source rights, evidence approval, instructional approval, direct reproduction permissions, AI/RAG permissions, or assessment eligibility.

## Dispositions

| Reference | Year | Disposition | Finding |
| --- | ---: | --- | --- |
| `nhtsa-fmvss-126-electronic-stability-control` | 2007 | current-authoritative | 49 CFR 571.126 remains in the current eCFR and still establishes ESC equipment and performance requirements for light vehicles. |
| `nist-tn1900-measurement-uncertainty` | 2015 | current-authoritative | Current NIST information-quality guidance still identifies TN 1900 as measurement-uncertainty guidance. |
| `nasa-systems-engineering-handbook-2016` | 2016 | current-authoritative-with-companion-update | NASA continues to publish the 2016 handbook; NASA-HDBK-1009A (2025) adds newer model-based systems-engineering guidance rather than generally replacing it. |
| `sae-nissan-can-diagnostic-flow-2014` | 2014 | historical-supporting | The SAE paper remains a useful Nissan/Infiniti CAN diagnostic-flow case study, but it is not a current universal OEM procedure. |
| `automotive-engine-diagnostic-survey-2012` | 2012 | historical-supporting | The peer-reviewed survey remains useful research/background literature but is not current service information. |

## Source-by-source review

### FMVSS No. 126 — Electronic Stability Control Systems

Current evidence: https://www.ecfr.gov/current/title-49/subtitle-B/chapter-V/part-571/subpart-B/section-571.126

The current eCFR still contains 49 CFR 571.126 and identifies it as the ESC standard for light vehicles. Its original rulemaking date is old, but the codified requirement remains current.

**Disposition:** `current-authoritative`.

**Use constraint:** Regulatory statements should be grounded in the current codified text, not merely the original 2007 rulemaking document.

### NIST Technical Note 1900

Current evidence: https://www.nist.gov/director/nist-information-quality-standards

NIST's current information-quality standards continue to name Technical Note 1900 as guidance for evaluating and expressing measurement uncertainty.

**Disposition:** `current-authoritative`.

**Use constraint:** Apply within measurement-uncertainty and measurement-results contexts.

### NASA Systems Engineering Handbook (2016)

Current evidence: https://www.nasa.gov/reference/systems-engineering-handbook/  
Companion update: https://standards.nasa.gov/standard/NASA/NASA-HDBK-1009

NASA continues to publish the 2016 Systems Engineering Handbook as agency guidance. NASA-HDBK-1009A, dated 2025, supplies newer model-based systems-engineering and SysML guidance.

**Disposition:** `current-authoritative-with-companion-update`.

**Use constraint:** Keep the 2016 handbook for general systems-engineering foundations; prefer the 2025 modeling handbook for MBSE/SysML-specific instruction.

### SAE 2014-01-1978 Nissan/Infiniti CAN diagnostic flow

Current evidence: https://saemobilus.sae.org/papers/network-diagnostic-flow-chart-troubleshoot-vehicle-level-communication-diagnostic-issues-nissan-infinity-vehicles-2014-01-1978

The SAE technical paper remains available and describes a bounded diagnostic flow for Nissan/Infiniti vehicle-level CAN faults. Its continued availability does not make it a current universal service procedure.

**Disposition:** `historical-supporting`.

**Use constraint:** Use for diagnostic-method examples and historical case-study context only. Current repair decisions must rely on current OEM service information and vehicle-specific procedures.

### Automotive engine diagnostic methods survey (2012)

Current evidence: https://doi.org/10.1177/1468087411422851

The peer-reviewed paper remains a valid scholarly survey of model-based and data-driven engine fault detection and isolation methods. It should not be read as current service information.

**Disposition:** `historical-supporting`.

**Use constraint:** Use for research literature, methods background, and historical scholarly context; not for current vehicle-specific service procedures or current regulatory claims.

## Audit conclusion

All five age-screen findings now have an explicit source-level currency disposition:

- **2** current-authoritative
- **1** current-authoritative-with-companion-update
- **2** historical-supporting
- **0** unresolved age-review findings

Age remains visible as metadata. The audit may suppress the unresolved-age flag only when a matching review record exists and carries one of the approved dispositions above.
