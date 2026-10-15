# Local Catalog Evidence Inventory

This directory records a **metadata-only candidate-source inventory** derived from a local collection of 29 automotive PDF catalogs/manuals.

The PDF files themselves are **not committed** and are not runtime content.

## Purpose

The inventory helps AutoLearnPro identify potentially useful source families for:

- component taxonomy and terminology;
- generic lab-asset planning;
- application awareness;
- possible future technical corroboration after rights and source review.

A `candidateUses` entry is **not permission**. It only records why a source may be worth reviewing.

## Fail-closed rights boundary

All records begin:

```text
rightsStatus                 = unverified-local-reference
citationAllowed              = false
ragIngestionAllowed           = false
modelContextAllowed           = false
reusableChunksAllowed         = false
transcriptIngestionAllowed    = false
figuresReuseAllowed           = false
engineeringValueImportAllowed = false
assetGeometryCopyingAllowed   = false
publicationAllowed            = false
```

This matches the existing project rule that automotive manufacturer/supplier material remains external/reference-only until explicit reuse rights are established.

## Relationship to labs and assets

Domain/component classifications are **triage metadata only**. They may inform what generic components AutoLearnPro should model, but they do not bind an asset to an engineering model and do not authorize copying vendor geometry, figures, tables, specifications, branding, or text.

Examples:

```text
Wagner brake catalogs → candidate Brake Systems component taxonomy
MOOG catalogs         → candidate Steering/Suspension/Driveline taxonomy
Fel-Pro / Sealed Power→ candidate Engine Mechanical taxonomy
Walker catalogs       → candidate Emissions/Exhaust taxonomy
Garrett / Champion    → candidate Engine Performance taxonomy
```

Vehicle-specific installation manuals are deliberately lower-trust for generic asset work and remain terminology/application-awareness candidates only.

## Local verification

The inventory stores file name, byte size, and SHA-256 for each observed PDF. To verify against a local collection, set:

```powershell
$env:CATALOG_SOURCE_DIR = 'F:\catalog'
node scripts/verify-catalog-evidence-inventory.js
```

Without `CATALOG_SOURCE_DIR`, the validator verifies repository governance only and does not require the local PDFs.

## No automatic promotion

Automation may inventory, hash, classify, detect duplicates, and prepare a review queue. It may not approve rights, approve evidence, ingest source text, publish assets, import engineering values, or grant assessment eligibility.
