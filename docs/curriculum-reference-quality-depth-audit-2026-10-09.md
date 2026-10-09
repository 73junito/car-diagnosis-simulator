# Curriculum Reference Quality & Depth Audit

Regenerate with: `npm run audit:curriculum-reference-quality`.

> This is a deterministic screening audit. A flag means “review this pairing,” not “the source is invalid.” It does not grant source rights, evidence approval, instructional approval, or assessment eligibility.

## Executive summary

- Lessons audited: **64**
- Multi-source lessons: **64**
- Strong: **46**
- Solid: **6**
- Review: **12**
- Lessons with at least one automotive-domain source: **52/64**
- Lessons with no automotive-domain source: **12**
- Technical sources meeting the age-review screen: **5**

## Screening rules

- **Strong:** at least two references, at least one automotive-domain source, and at least two authority families.
- **Solid:** at least two references and at least one automotive-domain source, but only one authority family.
- **Review:** fewer than two references or no automotive-domain source.
- **Age review:** technical-reference publication year is at least 10 years old. This is a freshness check only; foundational or still-current standards are not automatically stale.

## Review queue

| Level | Lesson | Rating | Refs | Domain refs | Authority families | Flags |
| --- | --- | --- | ---: | ---: | --- | --- |
| graduate | grad-aut520-data-analytics - Advanced Vehicle Data Analytics and Interpretation | review | 2 | 0 | federal-government, oer-foundation | no-automotive-domain-authority, technical-source-age-review |
| graduate | grad-aut585-digital-twins - Vehicle Digital Twins, Simulation, and Predictive Validation | review | 2 | 0 | federal-government, oer-foundation | no-automotive-domain-authority, generic-foundation-only |
| graduate | grad-curriculum-assessment-design - Technical Curriculum and Assessment Design | review | 2 | 0 | oer-foundation | no-automotive-domain-authority, single-authority-family, generic-foundation-only |
| graduate | grad-technical-instructional-leadership - Evidence-Informed Technical Instructional Leadership | review | 2 | 0 | federal-government, oer-foundation | no-automotive-domain-authority, generic-foundation-only |
| undergraduate | ug-aut115-measurement-instrumentation - Automotive Measurement, Instrument Selection, and Evidence | review | 2 | 0 | federal-government, oer-foundation | no-automotive-domain-authority, technical-source-age-review |
| undergraduate | ug-aut131-engine-lab - Engine Laboratory Inspection, Measurement, and Documentation | review | 2 | 0 | oer-foundation | no-automotive-domain-authority, single-authority-family, generic-foundation-only |
| undergraduate | ug-aut211-engine-performance-lab - Engine Performance Laboratory Testing and Evidence | review | 2 | 0 | oer-foundation | no-automotive-domain-authority, single-authority-family, generic-foundation-only |
| undergraduate | ug-aut251-diagnostics-lab - Automotive Diagnostics Laboratory Evidence and Fault Isolation | review | 2 | 0 | oer-foundation | no-automotive-domain-authority, single-authority-family, generic-foundation-only |
| undergraduate | ug-aut301-advanced-diagnostics-lab - Advanced Diagnostic Laboratory Testing and Fault Isolation | review | 2 | 0 | oer-foundation | no-automotive-domain-authority, single-authority-family, generic-foundation-only |
| undergraduate | ug-aut360-data-analysis - Vehicle Data Acquisition, Visualization, and Interpretation | review | 2 | 0 | oer-foundation | no-automotive-domain-authority, single-authority-family, same-publisher-only, generic-foundation-only |
| undergraduate | ug-aut400-research-methods - Automotive Research Questions, Methods, and Evidence | review | 2 | 0 | federal-government, oer-foundation | no-automotive-domain-authority, technical-source-age-review |
| undergraduate | ug-aut410-systems-integration - Integrated Vehicle Systems and Cross-Domain Reasoning | review | 2 | 0 | oer-foundation | no-automotive-domain-authority, single-authority-family, generic-foundation-only |
| graduate | grad-aut501-integrated-systems - Integrated Automotive Systems Analysis | solid | 2 | 2 | federal-government | single-authority-family, same-publisher-only, technical-source-age-review |
| undergraduate | ug-aut160-drivetrain-systems - Manual Transmission and Drivetrain System Relationships | solid | 2 | 1 | oer-foundation | single-authority-family |
| undergraduate | ug-aut220-automatic-transmissions - Automatic Transmission and Transaxle System Relationships | solid | 2 | 1 | oer-foundation | single-authority-family |
| undergraduate | ug-aut321-hybrid-lab - Hybrid Vehicle Laboratory Analysis and Evidence | solid | 2 | 2 | federal-government | single-authority-family |
| undergraduate | ug-aut331-electric-vehicle-lab - Electric Vehicle Laboratory Analysis and High-Voltage Evidence | solid | 2 | 2 | federal-government | single-authority-family |
| undergraduate | ug-hev-foundations - Electrified-Vehicle Architecture, Safety Boundaries, and Diagnostic Evidence | solid | 2 | 2 | federal-government | single-authority-family |
| graduate | grad-applied-research-literature - Scholarly Evidence for Applied Automotive Research | strong | 2 | 1 | oer-foundation, scholarly | technical-source-age-review |
| graduate | grad-diagnostic-evidence-analysis - Advanced Diagnostic Evidence Analysis | strong | 2 | 1 | oer-foundation, scholarly | technical-source-age-review |
| undergraduate | ug-aut200-engine-systems-ii - Advanced Engine Mechanical Systems and Diagnostic Evidence | strong | 2 | 1 | oer-foundation, scholarly | technical-source-age-review |
| undergraduate | ug-aut201-engine-systems-ii-lab - Engine Mechanical Laboratory Analysis and Measurement | strong | 2 | 1 | oer-foundation, scholarly | technical-source-age-review |
| undergraduate | ug-aut250-automotive-diagnostics-i - Systematic Automotive Diagnosis and Verification | strong | 2 | 1 | oer-foundation, scholarly | technical-source-age-review |
| undergraduate | ug-aut260-vehicle-dynamics - Vehicle Dynamics, Forces, and Stability Relationships | strong | 2 | 1 | federal-government, oer-foundation | technical-source-age-review |
| undergraduate | ug-aut310-network-communications - Vehicle Network Communications and Diagnostic Evidence | strong | 2 | 1 | oem-industry, oer-foundation | technical-source-age-review |
| undergraduate | ug-engine-performance-foundations - Engine-Performance Data Interpretation | strong | 2 | 1 | oer-foundation, scholarly | technical-source-age-review |
| undergraduate | ug-suspension-steering-foundations - Suspension and Steering Evidence Analysis | strong | 2 | 1 | federal-government, oer-foundation | technical-source-age-review |

## All lesson pairings

| Lesson | Rating | Reference | Publisher | Family | Domain | Role |
| --- | --- | --- | --- | --- | --- | --- |
| grad-applied-research-literature | strong | automotive-engine-diagnostic-survey-2012 | International Journal of Engine Research / SAGE | scholarly | yes | automotive-scholarly-literature-example |
| grad-applied-research-literature | strong | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | research-communication |
| grad-aut501-integrated-systems | solid | nasa-systems-engineering-handbook-2016 | National Aeronautics and Space Administration | federal-government | yes | systems-integration-foundation |
| grad-aut501-integrated-systems | solid | nasa-systems-modeling-handbook-2025 | National Aeronautics and Space Administration | federal-government | yes | model-based-systems-integration-reference |
| grad-aut515-systems-modeling | strong | nasa-systems-modeling-handbook-2025 | National Aeronautics and Space Administration | federal-government | yes | systems-modeling-verification-validation-reference |
| grad-aut515-systems-modeling | strong | nist-digital-twins-advanced-manufacturing | National Institute of Standards and Technology | federal-government | no | digital-model-validation-reference |
| grad-aut515-systems-modeling | strong | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | data-modeling-foundation |
| grad-aut520-data-analytics | review | nist-tn1900-measurement-uncertainty | National Institute of Standards and Technology | federal-government | no | measurement-data-uncertainty-reference |
| grad-aut520-data-analytics | review | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | data-literacy |
| grad-aut530-advanced-ev-systems | strong | doe-afdc-all-electric-car-architecture | U.S. Department of Energy Alternative Fuels Data Center | federal-government | yes | bev-system-architecture-reference |
| grad-aut530-advanced-ev-systems | strong | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | energy-systems-foundation |
| grad-aut535-battery-systems | strong | doe-vto-batteries | U.S. Department of Energy Transportation Technologies Office | federal-government | yes | vehicle-battery-rd-reference |
| grad-aut535-battery-systems | strong | openstax-chemistry-2e-2026 | OpenStax / Rice University | oer-foundation | no | electrochemistry-foundation |
| grad-aut540-power-electronics | strong | doe-vto-power-electronics-rd | U.S. Department of Energy Transportation Technologies Office | federal-government | yes | vehicle-power-electronics-rd-reference |
| grad-aut540-power-electronics | strong | fiore-ac-electrical-circuit-analysis-2021 | James M. Fiore | technical-other | yes | electrical-theory-reference |
| grad-aut545-energy-management | strong | doe-afdc-hybrid-electric-car-architecture | U.S. Department of Energy Alternative Fuels Data Center | federal-government | yes | hybrid-energy-flow-reference |
| grad-aut545-energy-management | strong | doe-vto-electric-drive-systems-rd | U.S. Department of Energy Transportation Technologies Office | federal-government | yes | electric-drive-integration-reference |
| grad-aut545-energy-management | strong | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | energy-systems-foundation |
| grad-aut550-automotive-networks | strong | nhtsa-cybersecurity-best-practices-modern-vehicles-2022 | National Highway Traffic Safety Administration | federal-government | yes | in-vehicle-network-security-reference |
| grad-aut550-automotive-networks | strong | openstax-introduction-computer-science-2026 | OpenStax / Rice University | oer-foundation | no | computing-foundation |
| grad-aut555-embedded-ecu | strong | nhtsa-cybersecurity-best-practices-modern-vehicles-2022 | National Highway Traffic Safety Administration | federal-government | yes | embedded-ecu-cybersecurity-reference |
| grad-aut555-embedded-ecu | strong | openstax-introduction-computer-science-2026 | OpenStax / Rice University | oer-foundation | no | computing-foundation |
| grad-aut560-adas-perception | strong | nhtsa-automated-driving-systems-guidance | National Highway Traffic Safety Administration | federal-government | yes | adas-oedr-safety-reference |
| grad-aut560-adas-perception | strong | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | data-analysis-foundation |
| grad-aut565-autonomous-systems | strong | nhtsa-automated-driving-systems-guidance | National Highway Traffic Safety Administration | federal-government | yes | automated-driving-system-safety-reference |
| grad-aut565-autonomous-systems | strong | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | data-analysis-foundation |
| grad-aut570-cybersecurity | strong | nhtsa-cybersecurity-best-practices-modern-vehicles-2022 | National Highway Traffic Safety Administration | federal-government | yes | vehicle-cybersecurity-best-practices-reference |
| grad-aut570-cybersecurity | strong | openstax-introduction-computer-science-2026 | OpenStax / Rice University | oer-foundation | no | computing-foundation |
| grad-aut575-software-defined-vehicle | strong | nhtsa-cybersecurity-best-practices-modern-vehicles-2022 | National Highway Traffic Safety Administration | federal-government | yes | software-lifecycle-cybersecurity-reference |
| grad-aut575-software-defined-vehicle | strong | openstax-introduction-computer-science-2026 | OpenStax / Rice University | oer-foundation | no | computing-foundation |
| grad-aut580-control-systems | strong | doe-vto-power-electronics-rd | U.S. Department of Energy Transportation Technologies Office | federal-government | yes | electric-drive-control-and-conversion-reference |
| grad-aut580-control-systems | strong | fiore-ac-electrical-circuit-analysis-2021 | James M. Fiore | technical-other | yes | electrical-theory-reference |
| grad-aut585-digital-twins | review | nist-digital-twins-advanced-manufacturing | National Institute of Standards and Technology | federal-government | no | digital-twin-validation-lifecycle-reference |
| grad-aut585-digital-twins | review | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | data-modeling-foundation |
| grad-aut590-technology-seminar | strong | doe-vto-electric-drive-systems-rd | U.S. Department of Energy Transportation Technologies Office | federal-government | yes | emerging-vehicle-technology-reference |
| grad-aut590-technology-seminar | strong | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | technical-communication |
| grad-curriculum-assessment-design | review | openoregon-open-curriculum-development-model | Open Oregon Educational Resources | oer-foundation | no | curriculum-alignment-assessment-design |
| grad-curriculum-assessment-design | review | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | professional-documentation |
| grad-diagnostic-evidence-analysis | strong | automotive-engine-diagnostic-survey-2012 | International Journal of Engine Research / SAGE | scholarly | yes | automotive-diagnostic-methods-reference |
| grad-diagnostic-evidence-analysis | strong | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | diagnostic-data-foundation |
| grad-technical-instructional-leadership | review | ies-continuous-improvement-education-toolkit-2020 | U.S. Department of Education, Institute of Education Sciences / REL Northeast & Islands | federal-government | no | continuous-improvement-leadership |
| grad-technical-instructional-leadership | review | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | stakeholder-technical-communication |
| grad-vehicle-systems-testing | strong | doe-vto-electric-drive-systems-rd | U.S. Department of Energy Transportation Technologies Office | federal-government | yes | electric-drive-validation-context-reference |
| grad-vehicle-systems-testing | strong | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | testing-data-foundation |
| ug-aut101-foundations | strong | osha-motor-vehicle-safety-aspects-2026 | Occupational Safety and Health Administration | federal-government | yes | safety-professional-foundation |
| ug-aut101-foundations | strong | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | professional-documentation |
| ug-aut105-safety-professional-practice | strong | epa-automotive-sectors-regulatory-information-2026 | U.S. Environmental Protection Agency | federal-government | yes | environmental-compliance-reference |
| ug-aut105-safety-professional-practice | strong | osha-motor-vehicle-safety-aspects-2026 | Occupational Safety and Health Administration | federal-government | yes | shop-safety-foundation |
| ug-aut105-safety-professional-practice | strong | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | professional-documentation |
| ug-aut110-automotive-math | strong | nist-si-2019 | National Institute of Standards and Technology | federal-government | yes | engineering-quantities-units-reference |
| ug-aut110-automotive-math | strong | openstax-algebra-trigonometry-2e-2026 | OpenStax / Rice University | oer-foundation | no | stem-foundation |
| ug-aut115-measurement-instrumentation | review | nist-tn1900-measurement-uncertainty | National Institute of Standards and Technology | federal-government | no | measurement-uncertainty-reference |
| ug-aut115-measurement-instrumentation | review | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | measurement-foundation |
| ug-aut121-electrical-lab | strong | fiore-ac-electrical-circuit-analysis-2021 | James M. Fiore | technical-other | yes | electrical-theory-reference |
| ug-aut121-electrical-lab | strong | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | stem-foundation |
| ug-aut130-engine-systems | strong | doe-internal-combustion-engine-basics | U.S. Department of Energy Transportation Technologies Office | federal-government | yes | engine-operation-architecture-reference |
| ug-aut130-engine-systems | strong | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | physics-foundation |
| ug-aut131-engine-lab | review | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | engineering-mechanics-foundation |
| ug-aut131-engine-lab | review | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | laboratory-documentation |
| ug-aut160-drivetrain-systems | solid | bccampus-diesel-drivetrain-systems-directory-record | BCcampus Open Education / SkillsCommons | oer-foundation | yes | drivetrain-service-foundation |
| ug-aut160-drivetrain-systems | solid | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | engineering-mechanics-foundation |
| ug-aut170-hvac-systems | strong | epa-mvac-section-609-servicing-2026 | U.S. Environmental Protection Agency | federal-government | yes | mvac-regulatory-service-reference |
| ug-aut170-hvac-systems | strong | openstax-chemistry-2e-2026 | OpenStax / Rice University | oer-foundation | no | chemistry-foundation |
| ug-aut180-service-information | strong | gm-pre-post-scan-position-2022 | General Motors | oem-industry | yes | oem-service-information-verification-reference |
| ug-aut180-service-information | strong | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | technical-communication |
| ug-aut200-engine-systems-ii | strong | automotive-engine-diagnostic-survey-2012 | International Journal of Engine Research / SAGE | scholarly | yes | engine-diagnostic-methods-reference |
| ug-aut200-engine-systems-ii | strong | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | engineering-mechanics-foundation |
| ug-aut201-engine-systems-ii-lab | strong | automotive-engine-diagnostic-survey-2012 | International Journal of Engine Research / SAGE | scholarly | yes | engine-diagnostic-methods-reference |
| ug-aut201-engine-systems-ii-lab | strong | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | engineering-mechanics-foundation |
| ug-aut211-engine-performance-lab | review | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | testing-data-foundation |
| ug-aut211-engine-performance-lab | review | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | laboratory-documentation |
| ug-aut220-automatic-transmissions | solid | bccampus-diesel-drivetrain-systems-directory-record | BCcampus Open Education / SkillsCommons | oer-foundation | yes | transmission-service-foundation |
| ug-aut220-automatic-transmissions | solid | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | engineering-mechanics-foundation |
| ug-aut230-automotive-electronics | strong | doe-vto-power-electronics-rd | U.S. Department of Energy Transportation Technologies Office | federal-government | yes | vehicle-power-electronics-reference |
| ug-aut230-automotive-electronics | strong | fiore-ac-electrical-circuit-analysis-2021 | James M. Fiore | technical-other | yes | electrical-theory-reference |
| ug-aut240-electrical-systems-ii | strong | bosch-alternator-technical-poster-2020 | Robert Bosch GmbH | oem-industry | yes | charging-system-architecture-reference |
| ug-aut240-electrical-systems-ii | strong | fiore-ac-electrical-circuit-analysis-2021 | James M. Fiore | technical-other | yes | electrical-theory-reference |
| ug-aut250-automotive-diagnostics-i | strong | automotive-engine-diagnostic-survey-2012 | International Journal of Engine Research / SAGE | scholarly | yes | automotive-diagnostic-methods-reference |
| ug-aut250-automotive-diagnostics-i | strong | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | diagnostic-data-foundation |
| ug-aut251-diagnostics-lab | review | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | testing-data-foundation |
| ug-aut251-diagnostics-lab | review | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | laboratory-documentation |
| ug-aut260-vehicle-dynamics | strong | nhtsa-fmvss-126-electronic-stability-control | National Highway Traffic Safety Administration | federal-government | yes | vehicle-stability-dynamics-reference |
| ug-aut260-vehicle-dynamics | strong | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | vehicle-dynamics-foundation |
| ug-aut270-emissions-systems | strong | epa-vehicle-emissions-im-obd-guidance-2026 | U.S. Environmental Protection Agency | federal-government | yes | emissions-obd-regulatory-reference |
| ug-aut270-emissions-systems | strong | openstax-chemistry-2e-2026 | OpenStax / Rice University | oer-foundation | no | chemistry-foundation |
| ug-aut280-control-systems | strong | bccampus-basic-motor-control-2020 | BCcampus | oer-foundation | no | control-systems-foundation |
| ug-aut280-control-systems | strong | doe-vto-power-electronics-rd | U.S. Department of Energy Transportation Technologies Office | federal-government | yes | electric-drive-control-reference |
| ug-aut300-advanced-diagnostics | strong | gm-pre-post-scan-position-2022 | General Motors | oem-industry | yes | post-repair-verification-reference |
| ug-aut300-advanced-diagnostics | strong | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | diagnostic-data-foundation |
| ug-aut301-advanced-diagnostics-lab | review | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | testing-data-foundation |
| ug-aut301-advanced-diagnostics-lab | review | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | laboratory-documentation |
| ug-aut310-network-communications | strong | openstax-introduction-computer-science-2026 | OpenStax / Rice University | oer-foundation | no | computing-foundation |
| ug-aut310-network-communications | strong | sae-nissan-can-diagnostic-flow-2014 | SAE International | oem-industry | yes | vehicle-can-diagnostic-reference |
| ug-aut320-hybrid-vehicle-technology | strong | nhtsa-electric-hybrid-vehicle-safety-2026 | National Highway Traffic Safety Administration | federal-government | yes | electrified-vehicle-safety-reference |
| ug-aut320-hybrid-vehicle-technology | strong | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | energy-systems-foundation |
| ug-aut321-hybrid-lab | solid | doe-afdc-hybrid-electric-car-architecture | U.S. Department of Energy Alternative Fuels Data Center | federal-government | yes | hybrid-architecture-energy-flow-reference |
| ug-aut321-hybrid-lab | solid | nhtsa-electric-hybrid-vehicle-safety-2026 | National Highway Traffic Safety Administration | federal-government | yes | high-voltage-safety-reference |
| ug-aut331-electric-vehicle-lab | solid | doe-afdc-all-electric-car-architecture | U.S. Department of Energy Alternative Fuels Data Center | federal-government | yes | bev-architecture-component-reference |
| ug-aut331-electric-vehicle-lab | solid | nhtsa-electric-hybrid-vehicle-safety-2026 | National Highway Traffic Safety Administration | federal-government | yes | high-voltage-safety-reference |
| ug-aut340-battery-management | strong | openstax-chemistry-2e-2026 | OpenStax / Rice University | oer-foundation | no | electrochemistry-foundation |
| ug-aut340-battery-management | strong | scholar-battery-soc-soh-review-2023 | World Electric Vehicle Journal / MDPI | scholarly | yes | battery-state-estimation-reference |
| ug-aut350-adas | strong | icar-adas-diagnostic-process-2025 | I-CAR | oem-industry | yes | adas-diagnostic-process-reference |
| ug-aut350-adas | strong | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | data-analysis-foundation |
| ug-aut360-data-analysis | review | openstax-introduction-computer-science-2026 | OpenStax / Rice University | oer-foundation | no | computational-foundation |
| ug-aut360-data-analysis | review | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | data-literacy |
| ug-aut370-embedded-systems | strong | nhtsa-cybersecurity-best-practices-modern-vehicles-2022 | National Highway Traffic Safety Administration | federal-government | yes | vehicle-electronic-security-architecture-reference |
| ug-aut370-embedded-systems | strong | openstax-introduction-computer-science-2026 | OpenStax / Rice University | oer-foundation | no | computing-foundation |
| ug-aut380-cybersecurity | strong | nhtsa-cybersecurity-best-practices-modern-vehicles-2022 | National Highway Traffic Safety Administration | federal-government | yes | vehicle-cybersecurity-best-practices-reference |
| ug-aut380-cybersecurity | strong | openstax-introduction-computer-science-2026 | OpenStax / Rice University | oer-foundation | no | computing-foundation |
| ug-aut390-connected-sdv | strong | nhtsa-cybersecurity-best-practices-modern-vehicles-2022 | National Highway Traffic Safety Administration | federal-government | yes | connected-vehicle-software-cybersecurity-reference |
| ug-aut390-connected-sdv | strong | openstax-introduction-computer-science-2026 | OpenStax / Rice University | oer-foundation | no | computing-foundation |
| ug-aut400-research-methods | review | nist-tn1900-measurement-uncertainty | National Institute of Standards and Technology | federal-government | no | measurement-research-methods-reference |
| ug-aut400-research-methods | review | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | research-communication |
| ug-aut410-systems-integration | review | bccampus-basic-motor-control-2020 | BCcampus | oer-foundation | no | control-systems-foundation |
| ug-aut410-systems-integration | review | openstax-introduction-computer-science-2026 | OpenStax / Rice University | oer-foundation | no | computing-systems-foundation |
| ug-aut420-internship | strong | osha-motor-vehicle-safety-aspects-2026 | Occupational Safety and Health Administration | federal-government | yes | professional-safety-practice-reference |
| ug-aut420-internship | strong | technical-writing-for-technicians-2019 | Linn-Benton Community College / Open Oregon Educational Resources | oer-foundation | no | professional-documentation |
| ug-aut450-capstone-i | strong | nasa-systems-modeling-handbook-2025 | National Aeronautics and Space Administration | federal-government | yes | systems-modeling-project-planning-reference |
| ug-aut450-capstone-i | strong | openstax-additive-manufacturing-essentials-2025 | OpenStax / Rice University | oer-foundation | no | design-prototyping-reference |
| ug-aut451-capstone-ii | strong | nasa-systems-modeling-handbook-2025 | National Aeronautics and Space Administration | federal-government | yes | systems-modeling-verification-validation-reference |
| ug-aut451-capstone-ii | strong | openstax-additive-manufacturing-essentials-2025 | OpenStax / Rice University | oer-foundation | no | design-prototyping-reference |
| ug-brakes-foundations | strong | nhtsa-fmvss-135-light-vehicle-brake-systems | National Highway Traffic Safety Administration | federal-government | yes | brake-system-regulatory-performance-reference |
| ug-brakes-foundations | strong | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | engineering-mechanics-foundation |
| ug-electrical-charging-system | strong | bosch-alternator-technical-poster-2020 | Robert Bosch GmbH | oem-industry | yes | charging-system-component-reference |
| ug-electrical-charging-system | strong | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | stem-foundation |
| ug-engine-performance-foundations | strong | automotive-engine-diagnostic-survey-2012 | International Journal of Engine Research / SAGE | scholarly | yes | automotive-diagnostic-methods-reference |
| ug-engine-performance-foundations | strong | openstax-principles-data-science-2025 | OpenStax / Rice University | oer-foundation | no | diagnostic-data-foundation |
| ug-hev-foundations | solid | doe-vto-electric-drive-systems-rd | U.S. Department of Energy Transportation Technologies Office | federal-government | yes | electric-drive-systems-reference |
| ug-hev-foundations | solid | nhtsa-electric-hybrid-vehicle-safety-2026 | National Highway Traffic Safety Administration | federal-government | yes | high-voltage-safety-reference |
| ug-suspension-steering-foundations | strong | nhtsa-fmvss-126-electronic-stability-control | National Highway Traffic Safety Administration | federal-government | yes | stability-control-steering-response-reference |
| ug-suspension-steering-foundations | strong | openstax-university-physics-v1-2026 | OpenStax / Rice University | oer-foundation | no | engineering-mechanics-foundation |

## Technical-source age review

| Reference | Publisher | Year |
| --- | --- | ---: |
| nhtsa-fmvss-126-electronic-stability-control - FMVSS No. 126 - Electronic Stability Control Systems | National Highway Traffic Safety Administration | 2007 |
| automotive-engine-diagnostic-survey-2012 - A survey on diagnostic methods for automotive engines | International Journal of Engine Research / SAGE | 2012 |
| sae-nissan-can-diagnostic-flow-2014 - Network Diagnostic Flow Chart-How to Troubleshoot Vehicle Level CAN Communication and CAN Diagnostic Issues on Nissan and Infinity Vehicles | SAE International | 2014 |
| nist-tn1900-measurement-uncertainty - Simple Guide for Evaluating and Expressing the Uncertainty of NIST Measurement Results | National Institute of Standards and Technology | 2015 |
| nasa-systems-engineering-handbook-2016 - NASA Systems Engineering Handbook | National Aeronautics and Space Administration | 2016 |

> Age-review entries require a human currency check before being described as outdated or current.
