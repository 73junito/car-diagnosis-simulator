# Phase 7A — Production Baseline Monitoring

Status: implementation candidate  
Scope: read-only production monitoring; no product, assessment, or data-model behavior changes

## Purpose

Phase 7A continuously checks the production baseline established by the 2026-10-09 release baseline. It is intended to detect external drift and production regressions after merge without changing production state.

## Monitored gates

The monitor runs these release contracts:

1. curriculum source-rights closure
2. California / Illinois / Texas privacy and AI overlays
3. 64/64 curriculum reference coverage
4. assessment governance boundary
5. three-surface production smoke
6. Google crawler access
7. public sitemap/indexability and internal-link integrity
8. production release-baseline integrity

A failure in any gate makes the scheduled workflow fail.

## Schedule

GitHub Actions runs the monitor daily at `13:17 UTC`. It can also be started manually with `workflow_dispatch`.

The off-hour minute is intentional so the workflow does not depend on top-of-hour scheduler load.

## Evidence

Each run writes:

`reports/production-baseline-monitor.json`

GitHub Actions uploads that report as a 30-day artifact and writes a gate-by-gate summary to the workflow run.

Successful runs do not create issues or modify production. Failed runs surface through the failed GitHub Actions run and its preserved report.

## Governance boundary

This monitor is observational. It does not:

- grant assessment eligibility,
- display governed assessment questions,
- enable scoring or grading,
- enable institutional or high-stakes assessment,
- deploy Workers,
- modify Supabase,
- modify Cloudflare configuration,
- alter Search Console state.

## Local command

```text
npm run monitor:production-baseline
```
