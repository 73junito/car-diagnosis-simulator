# Restored-auth smoke — P1 runtime authentication (implemented, not yet provisioned)

**Status: implemented in code; not verified end to end.** The workflow now wires
`RESTORED_TEST_USER_EMAIL` / `RESTORED_TEST_USER_PASSWORD` instead of the retired static JWT, and the
script authenticates at runtime. The dedicated restored-project test user does **not** exist yet and
those secrets are **not** provisioned, so the real run currently reports `NOT RUN` with a warning
annotation. P0 (`f1df7ef0`) is the separate diagnostic commit this builds on.

Base: PR #1128 head `50fa0991`. PR #1128 stays draft; the release-evidence HOLD and the October 13
staging migration discrepancy remain separate blockers.

---

## 1. Problem

`restored-access` fails at step 5 with `Malformed test-user JWT claims`, thrown in
`inspectTestToken()` **before any network call**. The stored environment secret
`RESTORED_TEST_USER_JWT` is non-empty and has three dot-separated segments, but its payload does not
decode to JSON, so the run never reaches Supabase.

Two separate issues are in play and must not be conflated:

1. **Confirmed:** the stored value is not a decodable Supabase access token. This is the current
   failure and it is independent of any clock.
2. **Prospective:** a static JWT is stale by construction. A Supabase access token's lifetime is
   configured by the project, commonly one hour; anything stored in a secret survives exactly one
   such window. *Correction to the earlier report: the secret's `updated_at` is metadata about the
   secret record, not evidence of the token's age. It shows only that the value has not been
   rewritten since 2026-10-25T04:55:11Z.* The shape defect stands on its own; the lifespan argument
   is about any replacement, not about the current value.

Manual replacement is therefore rejected: it re-creates issue 2 within the hour.

## 2. Goal

Obtain a token from the restored project's own GoTrue **during the run**, use it for one read-only
PostgREST GET, and never store, print or persist it. Fail closed at every step.

## 3. Prerequisite that this design cannot satisfy

A **dedicated, disposable, pre-confirmed user in the restored project** (`nbgvllelsfhnmuwuqlkw`).

- It must belong to the restored project. `TEST_TEACHER_EMAIL` / `TEST_TEACHER_PASSWORD` are
  **staging** credentials and must not be repointed here — different project, different `auth.users`,
  different signing keys.
- Its address must not require email confirmation, or confirmation must be completed during
  provisioning.
- Creating it is a provisioning action (Supabase admin or SQL) and is **out of scope**; it needs an
  approved path before P1 can be implemented and verified.

Until that user exists, P1 cannot be exercised end to end. This is the gating dependency, not code.

## 4. Required environment configuration (names proposed for approval)

Environment `nbgvllelsfhnmuwuqlkw`:

| Name | Kind | Purpose |
| --- | --- | --- |
| `RESTORED_TEST_USER_EMAIL` | secret (new) | disposable restored-project user identity |
| `RESTORED_TEST_USER_PASSWORD` | secret (new) | its password; used only to obtain a token |
| `ANON_KEY` | secret (existing) | `apikey` header for both the token request and the GET |
| `EXPECTED_SUPABASE_REF` | variable (existing) | project binding, unchanged |

`RESTORED_TEST_USER_JWT` becomes **unused**; removing it is P2 (owner-controlled) and deliberately
not part of this change.

## 5. Flow

```
preflight      EXPECTED_SUPABASE_REF === PROJECT_REF            else FAIL project-mismatch
               classifyCredential(ANON_KEY)                    else FAIL key-missing/invalid
credentials    both email and password present?
                 no  -> NOT RUN  (explicit; a green job is not authenticated evidence)
                 yes -> continue
sign-in        POST https://{ref}.supabase.co/auth/v1/token?grant_type=password
                 headers: apikey: ANON_KEY, Content-Type: application/json
                 body:    { email, password }
                 redirect: 'error', AbortSignal.timeout(15000)
               non-2xx or unusable body -> FAIL (sanitized code, no body, no credentials)
token checks   access_token is a string, then the P0 classifier:
                 segment count, base64url payload, JSON, role/sub/exp,
                 project `ref`, issuer `iss`, not expired
               plus consistency: exp > now; iat (if present) <= exp; iat (if present) <= now + skew
               FAIL on any violation -- never fall back to a stored token
read           GET https://{ref}.supabase.co/rest/v1/scenario_catalog?select=diagnostic_area&limit=1
                 headers: apikey: ANON_KEY, Authorization: Bearer <access_token>
               require 200 and a JSON array; report status + allowlisted codes only
```

Nothing from the sign-in response is used except `access_token`. `refresh_token`, `user` and the
rest of the body are dropped in memory and never logged, stored, or passed between steps.

## 6. Freshness checks — deliberately not a fixed cap

Per review guidance, the design does **not** hard-code a 3600-second maximum lifetime:

| Check | Rule | Rationale |
| --- | --- | --- |
| currently valid | `exp > now` | the only hard requirement |
| internally consistent | `iat <= exp` when `iat` is present | catches a corrupt or hand-assembled token |
| not obviously from the future | `iat <= now + 60s` | small skew allowance for clock drift |
| lifetime sanity | `exp > iat` when both present | a zero or negative lifetime is a defect |

A token whose lifetime exceeds one hour is legitimate if the project is configured that way, so it
is accepted. If a duration warning is wanted, it must be a non-failing annotation, not a gate.

## 7. Fail-closed classification (what the operator sees)

Every failure prints one line: a stage, a code and — at most — an allowlisted provider error code.
No response bodies, no credentials, no tokens.

| Stage | Code | Meaning |
| --- | --- | --- |
| preflight | `project-mismatch` | `EXPECTED_SUPABASE_REF` is not the restored project |
| preflight | `missing-api-key` / `invalid-api-key` | anon key absent or not a publishable/legacy key |
| credentials | `not-run` | email/password absent — **not** a pass |
| sign-in | `auth-http-<status>` | non-2xx from GoTrue; `<status>` is the only detail |
| sign-in | `auth-body-not-json` | sign-in response was not JSON |
| sign-in | `auth-missing-access-token` | JSON without a usable `access_token` |
| sign-in | `auth-provider-<code>` | GoTrue `error_code`, only when in an allowlist |
| token | P0 codes | `invalid-segment-count`, `malformed-payload-encoding`, `invalid-payload-json`, `invalid-claims`, `expired-token`, `project-mismatch`, `issuer-mismatch`, `clock-inconsistent` |
| read | `catalog-http-<status>` | PostgREST non-200 (401/403 here means authentication succeeded and authorization did not) |
| read | `catalog-not-array` | 200 with an unexpected body shape |

The 401/403 split at the read stage is the point of the exercise: it separates "our token was not
accepted" from "the token was accepted and the policy refused", which is exactly the ambiguity the
current single message creates.

## 8. Implementation sketch (not applied)

```js
// smoke-restored-supabase-authenticated.cjs
async function requestAccessToken({ fetchImpl = fetch, email, password, anonKey, timeoutMs = 15000 }) {
  const response = await fetchImpl(`${AUTH_URL}/token?grant_type=password`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) return { code: `auth-http-${response.status}` }
  let body
  try { body = await response.json() } catch { return { code: 'auth-body-not-json' } }
  if (!body || typeof body.access_token !== 'string' || !body.access_token) {
    return { code: 'auth-missing-access-token' }
  }
  return { accessToken: body.access_token }
}

// main(): preflight -> requestAccessToken -> inspectTestToken(token) + clock checks -> catalog GET
```

Seams for testing without network or secrets: `fetchImpl` injected, and the token/clock logic lives
in `classifyTestToken` (already injectable via `nowSeconds`). `main()` keeps its current contract:
any thrown error sets `process.exitCode = 1`.


## 9. Test matrix (to be implemented with P1)

All cases are offline: a stub `fetchImpl` and synthetic tokens. No secret, no network, no project.

| # | Case | Expected |
| --- | --- | --- |
| 1 | sign-in 200 `{access_token}`; catalog 200 `[]` | PASS, one POST + one GET, token used once |
| 2 | sign-in 400 (bad credentials) | FAIL `auth-http-400`, no GET performed |
| 3 | sign-in 401 (bad api key) | FAIL `auth-http-401`, no GET |
| 4 | sign-in 429 (rate limited) | FAIL `auth-http-429`, no GET |
| 5 | sign-in 500 | FAIL `auth-http-500`, no GET |
| 6 | sign-in 200 with non-JSON body | FAIL `auth-body-not-json` |
| 7 | sign-in 200 `{}` | FAIL `auth-missing-access-token` |
| 8 | sign-in 200 with `access_token: 42` | FAIL `auth-missing-access-token` |
| 9 | returned token has `role:"anon"` | FAIL `invalid-claims (claim: role)`, no GET |
| 10 | returned token expired | FAIL `expired-token`, no GET |
| 11 | returned token `iat > exp` | FAIL `clock-inconsistent`, no GET |
| 12 | returned token `ref` = other project | FAIL `project-mismatch`, no GET |
| 13 | returned token `iss` = other project | FAIL `issuer-mismatch`, no GET |
| 14 | catalog 401 | FAIL `catalog-http-401` (distinct from every auth failure) |
| 15 | catalog 403 | FAIL `catalog-http-403` |
| 16 | catalog 200 with `{code:...}` object | FAIL `catalog-not-array` |
| 17 | request aborted / timeout | FAIL with the abort cause, no GET |
| 18 | email/password absent, JWT absent | `NOT RUN`, exit 0, message states authenticated access was not proven |
| 19 | email/password absent, **JWT present** | `NOT RUN` — **no fallback to the static token** |
| 20 | any failure above | stdout+stderr contain no email, password, access token or response body (canary assertions) |
| 21 | token never written to `$GITHUB_OUTPUT`, artifacts or a file | asserted by absence of writes in the stub run |

## 10. Workflow change required with P1 (not applied)

```yaml
      - name: Verify dedicated authenticated restored-project catalog read when configured
        env:
          EXPECTED_SUPABASE_REF: ${{ vars.EXPECTED_SUPABASE_REF }}
          RESTORED_SUPABASE_ANON_KEY: ${{ secrets.ANON_KEY }}
          RESTORED_TEST_USER_EMAIL: ${{ secrets.RESTORED_TEST_USER_EMAIL }}
          RESTORED_TEST_USER_PASSWORD: ${{ secrets.RESTORED_TEST_USER_PASSWORD }}
        run: node scripts/smoke-restored-supabase-authenticated.cjs
```

Two env lines added, one removed, nothing else. `environment: nbgvllelsfhnmuwuqlkw`, the branch
guard `if:`, `permissions: contents: read` and `persist-credentials: false` all stay.

## 11. What a green run would and would not prove

Would prove: the restored project's GoTrue issues a token for that user, and PostgREST accepts it
for a policy-permitted catalog read.

Would not prove: tenant isolation, unauthorized-write denial, RLS policy equivalence with staging,
or any part of LMF release readiness. The script's trailing `NOTE` line must keep saying so.

## 12. Open questions for approval

1. Approve the secret names in §4, or specify alternatives.
2. Approve the provisioning path for the disposable user (§3) — the blocking prerequisite.
3. Confirm the read target stays `scenario_catalog` (one column, `limit=1`). A tenant-scoped read
   would be genuine isolation evidence and belongs to a separate, separately-approved test.
4. Decide whether `NOT RUN` should annotate the job (`::warning::`) so green is less misleading. The
   design keeps exit 0 either way and never converts a failure into a skip.


## 13. Machine-readable outcome (added after review)

Every run emits exactly one line, with a stable prefix and a single JSON object:

```
AUTH_SMOKE_OUTCOME {"outcome":"NOT_RUN","reason":"credentials-not-configured","authenticated":false,"tokenValidated":false,"catalogRead":false,"releaseEvidence":false}
```

| Outcome | Meaning | Exit |
| --- | --- | --- |
| `PASS` | real GoTrue sign-in succeeded, the token validated, and the authenticated catalog GET returned an array | 0 |
| `NOT_RUN` | credentials are not configured, so authentication was **not** verified | 0 |
| `FAIL` | sign-in, token validation or the catalog read failed; `reason` carries the code only | 1 |

`releaseEvidence` is **always false**, including on `PASS`. This smoke is diagnostic: a green run
does not establish tenant isolation, write denial or policy equivalence, so nothing here should ever
be consumed as release evidence. `NOT_RUN` additionally carries `authenticated:false`,
`tokenValidated:false`, `catalogRead:false`, so a parser keying off the record cannot read it as a
successful authenticated verification — it must check `outcome`, not merely the job status.

The record contains no credentials, no token, no JWT claims and no response body. `FAIL` records the
reason **code** (for example `auth-http-401`, `invalid-claims`, `catalog-http-403`) and never the
error message, so a message change cannot leak material into the record.

Exit behaviour is unchanged: `NOT_RUN` stays 0 (a configuration gap, not a test failure) and `FAIL`
stays 1. The record and the `::warning::` annotation are what make a green run unambiguous; the check
status alone is not evidence.

