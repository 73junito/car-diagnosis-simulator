# Production Release Baseline — 2026-10-09

**Baseline ID:** `production-release-baseline-2026-10-09`  
**Certified main SHA:** `9715aa014df2861531866895e3d81ce73585b22e`  
**Status:** Prepared for release-baseline verification

## Scope

This baseline closes the post-rights production-readiness sequence for AutoLearnPro without changing assessment eligibility.

Canonical production surfaces:

- Public: https://autolearnpro.com/
- Learner app/API: https://app.autolearnpro.com/
- Exam/prelaunch: https://exam.autolearnpro.com/

## Verified release gates

1. **Source-rights closure** — 38 expected curriculum sources; no effective `REUSE_UNVERIFIED` classification remains; the original seven unresolved sources are closed.
2. **State privacy/AI overlays** — California, Illinois, and Texas controls are represented in the release gate.
3. **Curriculum reference coverage** — 64/64 lesson plans covered: 43/43 undergraduate and 21/21 graduate.
4. **Assessment governance boundary** — no assessment eligibility, scoring, institutional assessment, high-stakes use, production assessment release, or question-display unlock is authorized.
5. **Three-surface production smoke** — public, app, and exam surfaces remain separated and their expected health/content contracts are checked.
6. **Google crawler access** — production crawler probe covers Google Inspection Tool and Googlebot behavior.
7. **Public indexability** — sitemap/canonical inventory is 7 URLs and internal public links are audited.

## Search indexing state

Google Search Console live URL inspection and sitemap checks were green after Cloudflare verified-bot handling was corrected. The production sitemap is:

`https://autolearnpro.com/sitemap.xml`

Expected canonical URL inventory:

- `/`
- `/institutions/`
- `/research-sources/`
- `/privacy`
- `/terms`
- `/contact`
- `/accessibility/`

Cloudflare verified-bot handling must remain enabled for Google crawler access.

## Assessment hold

This release baseline does **not** authorize:

- question display for governed assessment use,
- scored assessment,
- grading,
- institutional assessment,
- high-stakes assessment,
- production assessment API release.

Those remain separately governed decisions.

## Reproduction commands

```text
npm run audit:curriculum-source-rights
npm run validate:state-privacy-ai-overlays
npm run validate:curriculum-reference-coverage-baseline
npm run validate:assessment-governance-boundary
npm run validate:production-surfaces
npm run validate:google-crawler-access
npm run validate:public-indexability
npm run validate:production-release-baseline
```

The machine-readable record is at:
`data/release/production-release-baseline-2026-10-09.json`.
