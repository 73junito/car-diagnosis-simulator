# OBD-I / OBD-II source inventory — preliminary

**No comprehensive code catalog is licensed, verified or loaded by this change.**

| Candidate source | Coverage | Current decision |
| --- | --- | --- |
| EPA OBD program and emissions information | OBD-II background / regulation | Reference link only; not a full DTC glossary; https://www.epa.gov/state-and-local-transportation/vehicle-emissions-inspection-and-maintenance-im-policy-and-technical |
| SAE J2012 / ISO 15031-6 standards | Standardized OBD-II DTC terminology and definitions | Licensing/access review required; do not reproduce a copyrighted code list |
| Manufacturer service documentation | Manufacturer-defined OBD-I retrieval and DTC application; proprietary OBD-II definitions | Vehicle/year/engine and publisher rights required before ingestion |
| Existing repository dataset (`obd2_codes_database.json`) | Five illustrative OBD-II records | Existing sample only; provenance and licensing **unverified**; not approved for bulk production import |

OBD-I formats are manufacturer-, year- and application-dependent; an OBD-I number by itself cannot be interpreted safely without that context. OBD-II codes also require applicability, standards/version and source checks. The proposed schema stores protocol generation, code, manufacturer, vehicle model, year range, original reference and verification status independently of the existing scenarios.

Sources remain **review pending**. No reference text, diagrams, proprietary service procedures or bulk codes are copied into Supabase. There is no public client read policy, automatic scoring, repair eligibility, production API, or grades.
