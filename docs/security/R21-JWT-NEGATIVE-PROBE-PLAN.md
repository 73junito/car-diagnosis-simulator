# R21 — Staging JWT negative-probe plan (DRAFT, never executed)

**Status: DRAFT — R21 remains UNVERIFIED.**
This package has **not** been run against staging, committed, pushed, or merged. It is
submitted for review before any execution.

| Field | Value |
| --- | --- |
| Base commit | `131daa44d5f39745ca32fc6b38ed9904962d707b` (`main`) |
| Worktree | `/home/rod/r21-jwt-probe` (branch `test/r21-jwt-negative-probes`, **uncommitted**) |
| Workflow | `.github/workflows/r21-jwt-negative-probes.yml` (draft) |
| Runner | `tests/r21/jwt-negative-probes.mjs` |
| Validator | `tests/r21/validate-workflow.mjs` |
| Local validation | runner self-test **10/10**, validator **26/26**, fail-closed **6/6** |
| Staging contact so far | **none** |

## 1. Objective, and what this is not

Objective: demonstrate that the **real staging authentication boundary** rejects tokens it
must reject — forged, malformed, expired, and `alg=none`.

Not the objective: implementing a local JWT verifier. Production does not verify locally;
`api/_utils/auth-utils.js:31` delegates to Supabase:

```js
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {...});
const { data: { user } } = await supabase.auth.getUser(token);   // -> GET /auth/v1/user
```

Signature and expiry enforcement therefore live in GoTrue, not in this repository. Adding
a local verifier would create verification logic that production never executes, and any
test of it would be worthless. The workflow asserts the boundary's behaviour instead.

## 2. Probe matrix

Single read-only application path: `GET /rest/v1/syllabi?select=id&limit=1`. **Ten
requests total**, sequential, 500 ms apart, in three phases.

| Phase | Request | Authorization | Expected | Proves |
| --- | --- | --- | --- | --- |
| 1 | anonymous reachability control | none (apikey only) | **200** | host and path are correct; PostgREST answers; RLS filters rows |
| 2a | password grant with the dedicated smoke identity | apikey only | **200** | a legitimate staging session can be obtained |
| 2b | authenticated positive control | real staging JWT | **200** | the same endpoint **accepts** a valid token |
| 3.1 | malformed: two segments | `Bearer not.a-jwt` | 400/401 | structurally invalid token rejected |
| 3.2 | malformed: not a token | `Bearer definitely-not-a-token` | 400/401 | non-JWT bearer rejected |
| 3.3 | malformed: empty bearer | `Bearer ` | 400/401 | empty credential rejected |
| 3.4 | `alg=none`, empty signature | unsigned token | 400/401 | unsigned-token bypass rejected |
| 3.5 | HS256 forged signature | random-key signature | 400/401 | signature not accepted when it cannot validate |
| 3.6 | past-`exp` token, random-key signature | random-key signature | 400/401 | **invalid JWT rejected — expiry not demonstrated** (§4) |
| 3.7 | foreign `aud`, random-key signature | random-key signature | 400/401 | **invalid JWT rejected — audience not demonstrated** (§4) |

Pass criteria:

- Phase 1 must return **200**; otherwise the run aborts (exit 2) because a later 404 would
  be indistinguishable from a rejected token.
- Phase 2a must return a token and phase 2b must return **200**. If either fails the run
  stops (exit 1): without a satisfied positive control, the negative results below cannot
  be interpreted.
- Phase 3 must return **400 or 401**. A **404** is explicitly *not* a pass (wrong path),
  and any **2xx** is a finding.

The positive control is **contemporaneous**: it signs in during the same run, so it
validates the exact host, endpoint and authentication path used by the probes rather than
relying on earlier smoke runs.


## 3. Two design flaws this package corrects

Both were found and fixed before any execution; they are recorded because each would have
produced confident, meaningless results.

1. **"Any 4xx is a rejection" is unsound.** A wrong host or path returns 404, which that
   rule would have counted as a successful rejection — a perfect-looking boundary that was
   never exercised. The pass rule is now 400/401 only, 404 is explicitly marked "not
   evidence", and a phase-1 control must return 200 or the run aborts.
2. **A negative-only suite passes when the boundary rejects everything.** The staged
   positive control (phase 2) now obtains a real JWT during the same run and requires the
   same endpoint to answer **200**. Without that, a misconfigured project — or a wrong
   endpoint path — would satisfy every negative probe.

The same class of error appeared twice already in this programme: the R26 harness reported
8/10 while six denials passed for the wrong reason (a stub returning zero rows), and the
R22 harness initially granted default privileges to the wrong role set.

## 4. What this cannot establish

- **Expiry is not isolated from signature — UNVERIFIED.** We do not hold the project's JWT
  secret and must not, so a "past-`exp`" token is necessarily also badly signed. Probe 3.6
  therefore demonstrates rejection of an invalid JWT, *not* independent enforcement of
  expiry. The same applies to audience in probe 3.7.
- **Expiry/audience can only be separated with a properly signed token**, which requires
  either (a) an authorized, isolated authentication environment whose signing key we
  control, or (b) a real session whose token is allowed to genuinely expire — a
  time-based test, not a synthetic one.
- **No data-access assertion.** All probes are unauthenticated or authenticated *reads* of
  one endpoint; they say nothing about tenant isolation or what an authorized caller can
  retrieve.
- **No PostgREST-vs-GoTrue attribution.** A 401 may originate at either layer.
- **The positive control is an authenticated read**, so it does not prove authorization
  logic beyond "a valid token is accepted for this endpoint".
- **Session side effect.** The password grant creates a GoTrue session row. No application
  data is written, but this is not a zero-write operation and should be reviewed as such.


## 4a. Identity, endpoint and side-effect boundaries (per review)

| Boundary | Decision |
| --- | --- |
| Principal | The **dedicated** `SMOKE_TEACHER_*` identity, never the shared `TEST_TEACHER_*` account. Verified at name level: `SMOKE_TEACHER_EMAIL/PASSWORD` are referenced **only** by `smoke.yml`; `API_SMOKE_TEACHER_*` only by `api-smoke.yml`; the shared `TEST_TEACHER_EMAIL` is used by **five** workflows. This draft adds a second reference to the dedicated identity (the same account the smoke workflow already uses), not a new use of the shared account. |
| Side effect | Exactly **one** GoTrue password grant. It creates an authentication **session**; the workflow is **application-data read-only, not strictly read-only**. |
| Administrative repair | **Never attempted.** The runner has no admin or service-role credential and no password-update path; `POST /auth/v1/token` is the only non-GET call it can make. |
| Endpoint | `GET /rest/v1/syllabi?select=id&limit=1` retained for the first run. |
| What a 200 means | The positive control asserts **JWT acceptance** (the request succeeds), not access to any particular syllabus. The dedicated teacher owns no syllabi in staging, so **200 with zero visible rows is the expected and acceptable outcome**. |
| What a 200 does not mean | A success response is not proof that the JWT was cryptographically verified. The complementary evidence is the **forged-signature** probe (3.5), which must be rejected for a token that is structurally valid but cannot validate. |


| Control | Implementation |
| --- | --- |
| Destination allowlist | hard-coded `ALLOWED_HOSTS` = `jchfruprqpeypdttvlam.supabase.co`; `https:` only; non-default ports refused; redirects refused (`redirect: 'error'`) |
| Read-only application data | one `GET` path; **one** non-GET call exists and it is only the auth password grant (`POST /auth/v1/token?grant_type=password`). No PUT/PATCH/DELETE anywhere |
| No administrative credential | only `STAGING_URL`, `STAGING_ANON` (publishable) and the dedicated `SMOKE_TEACHER_EMAIL`/`SMOKE_TEACHER_PASSWORD`. No service-role key, no JWT secret, no CLI token |
| Rate limit | `MAX_REQUESTS = 10` (1 anon GET + 1 grant + 1 authenticated GET + 7 negatives), sequential, 500 ms spacing — far below the documented 100 req/15 min per-IP limit |
| Timeouts | `REQUEST_TIMEOUT_MS = 10_000` per request; job `timeout-minutes: 10` |
| No sensitive output | GET bodies are cancelled unread; the grant response body is read only to extract `access_token` and is never printed; only labels and status codes are output; secrets passed via `env:` and never interpolated into shell text; no `set -x` |
| Fail closed | missing config, missing credentials, non-allowlisted host, non-TLS URL, unreachable control probe → exit 2 without probing further; failed positive control or accepted token → exit 1 |
| No accidental execution | `workflow_dispatch` only, plus two manual gate inputs (`confirm` must equal `probe-staging-readonly`, `acknowledgement` must be checked) |
| No overlapping runs | `concurrency: r21-jwt-negative-probes` |
| Least privilege | `permissions: contents: read`; actions pinned to full commit SHAs |

`STAGING_URL`, `STAGING_ANON`, `SMOKE_TEACHER_EMAIL` and `SMOKE_TEACHER_PASSWORD` were
confirmed to exist as secret **names** in the `jchfruprqpeypdttvlam_staging` environment;
their values were never read.

## 6. Preconditions before the first run

1. Maintainer review of this document and the workflow diff.
2. Confirm `GET /rest/v1/syllabi?select=id&limit=1` is the intended read-only surface — if
   a narrower path is preferred, change `READONLY_PATH` in the runner (one constant).
3. Confirm the **dedicated** smoke identity is the right principal for the positive
   control. Using `SMOKE_TEACHER_*` (not `TEST_TEACHER_*`) keeps this aligned with the
   per-workflow identities shipped in #1132.
4. Accept that the staging environment applies a ~5-minute wait timer to jobs using it, so
   a manual run will appear to queue before starting.
5. Accept the session side effect: the password grant creates a GoTrue session row.
6. Agree that any 2xx on a phase-3 probe, or a failed phase-2 control, stops the programme
   and is reported rather than retried.
7. Accept that probes 3.6/3.7 remain **rejection-only**; expiry and audience enforcement
   stay **UNVERIFIED** until properly signed tokens can be obtained from an authorized,
   isolated authentication environment (§4).

## 7. Review checklist

- [ ] Trigger is `workflow_dispatch` only
- [ ] Confirmation inputs are required and fail closed
- [ ] Allowlist host matches the approved staging project
- [ ] No service-role or administrative credential anywhere
- [ ] No application-data write verbs; the only POST is the auth token grant
- [ ] Contemporaneous positive control present and required
- [ ] Request cap, per-request timeout, job timeout
- [ ] No body/secret/token output
- [ ] Pass criteria are 200-control + 400/401-only (404 explicitly not a pass)
- [ ] Expiry/audience marked UNVERIFIED, not claimed as tested
- [ ] Actions pinned to full SHAs; `permissions: contents: read`
- [ ] Positive-control dependency on staging smoke runs is documented

## 8. Local validation performed (no staging contact)

```bash
cd /home/rod/r21-jwt-probe
node tests/r21/jwt-negative-probes.mjs --self-test   # 10/10 PASS, exit 0
node tests/r21/validate-workflow.mjs                 # 26/26 checks, exit 0
```

Fail-closed behaviour verified with deliberately invalid configuration — all six cases exit
2 without any network call:

| Case | Output |
| --- | --- |
| no env | `REFUSING TO PROBE: STAGING_URL is not set` |
| `http://` target | `REFUSING TO PROBE: refusing non-TLS target (http:)` |
| non-allowlisted host | `REFUSING TO PROBE: refusing non-allowlisted host (evil.example.com)` |
| allowlisted host, no anon key | `REFUSING TO PROBE: STAGING_ANON is not set` |
| allowlisted host + anon key, no teacher credentials | `REFUSING TO PROBE: SMOKE_TEACHER_EMAIL / SMOKE_TEACHER_PASSWORD are required for the positive control` |
| `http://` target with all credentials present | `REFUSING TO PROBE: refusing non-TLS target (http:)` |

The self-test also asserts the structural guarantees with no network: single-host allowlist,
probe budget covering the grant and positive control, first probe is the anon control, and
that the expiry/audience probes carry their limitation caveat.

`js-yaml` for the validator is resolved out-of-tree from `/tmp/r21-deps`, so no dependency
file in this repository changes.

## 9. Status of the security programme

- **R21**: UNVERIFIED. This package prepares evidence; it does not supply it.
- **R22**: UNVERIFIED. The PGlite package adds engine-level RLS evidence only; see
  `docs/security/R22-PGLITE-RLS-EVIDENCE.md` on the sibling branch.
- **R26**: PARTIAL, unchanged.

Nothing was executed against staging, committed, pushed, merged, deployed, or changed in
any production or staging configuration.

