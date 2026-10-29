# Dependabot #134 / #135 — `deepmerge` Exposure Assessment

**Status:** open, undismissed · **Decision required:** accept the documented exposure, then
dismiss with a specific justification — not a false-positive designation.
**Scope:** assessment only. This document proposes **no** dependency change.

| Field | Value |
| --- | --- |
| Advisory | `GHSA-gcqx-w48m-w2h4` / `CVE-2026-93753` |
| Summary | `deepmerge` `mergeObject()` allows prototype poisoning of returned objects |
| Severity | Low |
| Vulnerable range | `>= 4.2.0, <= 4.3.1` |
| First patched version | **none published** |
| Alerts | #134 (`package-lock.json`), #135 (`torquemind-api/package-lock.json`) |

Both alerts are the same advisory in two dependency trees, not two vulnerabilities.

## 1. Affected dependency chains

| Manifest | Chain | Type |
| --- | --- | --- |
| `package-lock.json` | `jest@30.5.2 → @jest/core@30.5.2 → jest-config@30.5.2 → deepmerge@4.3.1` | transitive, development |
| `torquemind-api/package-lock.json` | `jest@30.4.2 → @jest/core@30.4.2 → jest-config@30.4.2 → deepmerge@4.3.1` | transitive, development |

`deepmerge` is not a direct dependency in either manifest, and no repository source file
imports it — there is no `require('deepmerge')`, no `import … from 'deepmerge'`, and no
`mergeObject` reference outside `node_modules`.

## 2. Reachability

The vulnerable function is genuinely reached, but only through Jest's configuration merging:

- `deepmerge()` is implemented in terms of `mergeObject()` (`node_modules/deepmerge/index.js:92`),
  so calling `deepmerge` enters the affected code.
- `jest-config` calls `deepmerge(` four times when normalising configuration.
- The library does contain a prototype guard (`index.js:47-50`) that the advisory characterises as
  incomplete, which is why the advisory exists rather than being a plain false positive.

Input provenance is the deciding factor:

| Question | Finding |
| --- | --- |
| Does any runtime/production code path load `deepmerge`? | No. `worker/`, `api/`, `dashboard/` never import it, and it is absent from the deployed bundle. |
| What does Jest merge? | Static config: root `jest.config.js` (`module.exports = {…}`), `torquemind-api` package.json `jest` key (`testEnvironment`, `testMatch`), plus CLI flags. |
| Can request data reach the merged objects? | No. There is no HTTP path into Jest configuration in this repository. |
| Is the vulnerable function exercised with attacker-controlled keys? | Not in the reviewed usage. Keys come from committed configuration. |

## 3. Trust boundary and CI assumptions

Repository-controlled configuration is *not* automatically trusted, so this section is explicit
about where the boundary sits.

- All workflows that run on pull requests use `pull_request`, and **no workflow in this repository
  uses `pull_request_target`**. A fork PR therefore runs with a read-only token and without
  repository secrets.
- `ci.yml` declares no elevated `permissions:` block; it inherits the repository default and does
  not grant write access.
- `jest.config.js` and both `package.json` manifests are committed files: changing them requires a
  reviewed pull request merged to `main`.

The consequence for this advisory: an actor able to alter `jest.config.js` or the manifests can
already execute arbitrary code in CI through `setupFiles`, `transform`, or lifecycle scripts. In
that threat model, prototype poisoning of an object inside the Jest process grants **no capability
the actor does not already have**, and it cannot reach production data, which is never loaded by
the affected process.

Residual risk accepted: a merged configuration change could poison prototypes of objects merged
during a test run, corrupting that run's results. Impact is confined to CI run integrity and is
detectable as test failure or inconsistency, not silent data exposure.

## 4. Patch status

There is nothing to upgrade to:

- The latest published `deepmerge` is **4.3.1** — inside the vulnerable range (`<= 4.3.1`), and the
  advisory records no first patched version.
- `npm audit fix` offers `jest@25.1.0`, a **major-version downgrade**, not a remediation.
- An `overrides`/`resolutions` entry would pin a version with no published fix, adding an
  unreviewed resolution to both lockfiles for no security benefit.
- Pinning below `4.2.0` swaps a documented, low-severity, non-reachable issue for an undocumented
  older dependency — a regression in transparency rather than an improvement.

No dependency change is proposed until a patched release exists.

## 5. Exposure conclusion

**Accepted, with conditions.** The vulnerable function is reachable only from development tooling,
with repository-controlled input, behind a CI trust boundary that grants no additional capability
to an actor who can already change that input. No production surface is affected.

This acceptance is conditional on the re-evaluation triggers below. It is not a false positive:
the code path exists and would matter if the input provenance ever changed.

## 6. Conditions requiring re-evaluation

Re-review this assessment immediately if any of the following becomes true:

1. A patched `deepmerge` version is published — upgrade and close both alerts normally.
2. `jest` / `jest-config` bumps its `deepmerge` dependency — re-check the resolved version.
3. `deepmerge` appears in **runtime** dependencies, or any non-test file imports it.
4. Merged objects can contain keys derived from request data, uploads, environment input, or any
   other untrusted source.
5. Jest configuration becomes dynamically loaded from a non-repository source.
6. A workflow is introduced that uses `pull_request_target`, or a workflow with write permissions
   starts executing pull-request code.
7. The advisory is re-scored, or a public exploit is published that does not require config
   control.

## 7. Proposed dismissal justification

If the exposure above is accepted, dismiss #134 and #135 with:

> Vulnerable function is reachable only through Jest configuration merging in development tooling.
> Input is repository-controlled configuration behind a reviewed-merge trust boundary; no
> production code path imports `deepmerge` and no request data reaches it. No patched version has
> been published (latest 4.3.1 is affected). Documented in
> `docs/security/DEPENDABOT-134-135-DEEPMERGE-ASSESSMENT.md`; re-evaluation triggers recorded there.

Both alerts should stay **open** until that documentation is reviewed.

## 8. Deliberately not done here

- No `npm audit fix`, in either tree.
- No `overrides` / `resolutions` entry.
- No lockfile modification.
- No alert dismissal.
- No change to Jest, Babel, or test configuration.

## 9. Evidence

| Command | Result |
| --- | --- |
| `npm ls deepmerge --all` (root) | `jest@30.5.2 → @jest/core → jest-config → deepmerge@4.3.1` (dev) |
| `npm ls deepmerge --all` (`torquemind-api`) | `jest@30.4.2 → @jest/core → jest-config → deepmerge@4.3.1` (dev) |
| `grep -rn "require('deepmerge')\|from 'deepmerge'\|mergeObject"` (source, excl. `node_modules`) | no matches |
| `grep -rn 'pull_request_target' .github/workflows/` | no matches |
| `npm audit --json` (both trees) | `deepmerge` low, transitive, development |
| `npm view deepmerge version` | `4.3.1` (latest; still in the vulnerable range) |
| `GET /advisories/GHSA-gcqx-w48m-w2h4` | vulnerable `>= 4.2.0, <= 4.3.1`; `first_patched_version: null` |
| `node_modules/deepmerge/index.js:92` | `return mergeObject(target, source, options)` |
