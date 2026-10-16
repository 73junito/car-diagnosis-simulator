# AutoLearnPro Engineering Evidence Register (initial coverage)

Scope: seven currently identified student laboratory surfaces: circuit, starting-system, multivoltage, sensor, actuator, network, and relay-load. This is an **initial source discovery and requirements inventory**, not a completed certification of engineering specifications for every component.

The evidence register is `data/engineering-evidence/lab-source-register.json`. Manufacturer facts must preserve exact model, parameter, unit, citation URL or PDF page, and independent technical review state. A reference-only DENSO manual is not redistributable course content.

## Source hierarchy
1. Manufacturer service manual / dimensioned drawing matching a known part number and revision.
2. Manufacturer product datasheet / published engineering specification matching model.
3. Manufacturer general technical manual for operating principles and relative component arrangement.
4. Scholarly/open education works for theoretical explanation, checked for reuse permissions.
5. Illustrative CAD and Meshy generation for presentation only; **never** measurement authority.

The local DENSO starter-alternator manual provides operating principles, diagnostics and a component wall chart (p. 9, 11, 14, 17, 42–47, 53–57), but not proven mating geometry for the existing seven-piece alternator. DENSO's publication notice states all rights reserved and prohibits copying without permission: reference by filename/page only. See manufacturer confirmation: https://www.denso-am.eu/news/july-2017-newsletter-latest-starters-alternators-manual-offers-denso-s-technical-expertise .

Manufacturer external discovery: Bosch Motorsport B3 LIN has model-specific body diameter 136 mm (without screw), body length 117 mm (without pulley), B+ connection M8x1.25, and default regulation voltage 14.4 V in its manufacturer catalog, https://www.bosch-motorsport.com/media/downloads/catalogs/printkatalog_2021.pdf . **Do not apply these dimensions to the generic seven-part alternator**; no equivalence or mounting drawing was established.

Further engineering work should identify *specific manufacturers and part numbers* for each lab, retrieve revisioned matching service data, verify geometry and connector/keying/contact numbering, and attach measured/verified evidence to the per-asset review. Where no exact source is available, label dimension `unknown`, keep asset illustrative and block publication as a validated engineering model. No generic universal pass/fail voltage thresholds should be introduced.

## Proposed alternator interior expansion
Treat DENSO p. 53 as a structural reference for stator, rectifier, IC regulator, cooling fan and bearing and maintain the seven existing externally addressable nodes. Add interior parts in a separate reviewed prototype, not a silent rewrite of the approved seven-node contract. Actual fit, axis alignment and electrical topology require part-specific drawings and a reviewer.
