# Per-workflow staging smoke teacher identities

The staging smoke workflows (`smoke.yml` and `api-smoke.yml`) used to sign in
with one shared teacher identity (`TEST_TEACHER_EMAIL`). That identity is also
used by `release.yml` and by the production sign-in workflows
(`curriculum-evidence-production-e2e.yml`, `semantic-scholar-production-smoke.yml`).

GoTrue revokes **every** session a user holds whenever its password changes
(`User.UpdatePassword` → `Logout` → `DELETE FROM auth.sessions WHERE user_id = ?`).
A fixture repair performed by one workflow therefore invalidated the access
token of the sibling workflow that was signed in at that moment, which then
failed with `401 Invalid or expired token`. See
`docs/staging-smoke-concurrency.md` for the recorded incident.

This document describes the isolation model that removes the shared state.

## Identity scopes

`torquemind-api/scripts/smoke-test.js` resolves the identity through
`resolveTeacherCredentials()` and assigns one of three scopes:

| Scope | Selected when | Password reset |
| --- | --- | --- |
| `dedicated` | `DEDICATED_TEACHER_EMAIL` and `DEDICATED_TEACHER_PASSWORD` are both set | Allowed — the identity belongs to this workflow alone |
| `shared-isolated` | No dedicated credentials, and `SMOKE_TEACHER_ISOLATED=true` | **Refused** — the run fails with a remediation message instead of revoking a sibling's session |
| `shared` | No dedicated credentials, and `SMOKE_TEACHER_ISOLATED` is not `true` | Allowed — unchanged legacy behaviour |

Only half of the dedicated pair may be set; a partial pair is a configuration
error and aborts the run rather than silently falling back to the shared
identity.

## Required GitHub Actions secrets

Two disposable identities are needed, one per staging smoke workflow. Store
them as **environment secrets** on the `jchfruprqpeypdttvlam_staging`
environment:

| Workflow | Secret name | Identity |
| --- | --- | --- |
| `.github/workflows/smoke.yml` | `SMOKE_TEACHER_EMAIL`, `SMOKE_TEACHER_PASSWORD` | `…+smoke-staging-a` plus-alias |
| `.github/workflows/api-smoke.yml` | `API_SMOKE_TEACHER_EMAIL`, `API_SMOKE_TEACHER_PASSWORD` | `…+smoke-staging-b` plus-alias |

Both identities are provisioned (2026-10-25). They are plus-aliases of the
same mailbox the other disposable staging accounts use, following the
convention already established in this project. The literal addresses are not
committed here — they are recorded in the environment secrets themselves, so
read them from GitHub rather than from this document.

Each workflow maps its own pair onto `DEDICATED_TEACHER_EMAIL` /
`DEDICATED_TEACHER_PASSWORD`, so the two workflows never share an identity.

`release.yml` and the production workflows are deliberately left on the shared
identity and are not changed by this work.

## Provisioning an identity

Identities are provisioned by an operator, never by a workflow run. The helper
refuses to run inside CI, refuses to touch any Supabase project other than the
approved staging project (`jchfruprqpeypdttvlam`), and refuses to provision the
shared identity itself.

```powershell
cd torquemind-api
$env:SUPABASE_URL = 'https://jchfruprqpeypdttvlam.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = '<staging service role key>'
$env:SMOKE_TEACHER_EMAIL = '<the disposable address for this workflow>'
$env:SMOKE_TEACHER_PASSWORD = '<generated password>'
$env:TEST_TEACHER_EMAIL = '<the shared identity email>'
$env:SECRET_NAME_PREFIX = 'SMOKE_TEACHER'   # or API_SMOKE_TEACHER

node scripts/provision-smoke-teacher-identity.js
```

The script creates the auth user (or updates the password of an existing one),
upserts the matching `profiles` row with `role = 'teacher'`, and prints the
`gh secret set` commands for the owner to run. The password is never printed.

To remove an identity again:

```powershell
node scripts/provision-smoke-teacher-identity.js --cleanup
```

## Fallback behaviour

The dedicated secrets are provisioned, so both staging smoke workflows run in
the `dedicated` scope and can repair their own identity without touching
anyone else's sessions.

If the dedicated secrets are ever removed, both workflows fall back to the
shared identity with `SMOKE_TEACHER_ISOLATED=true`. In that state the run
still signs in normally, but if the stored shared credential is rejected
(HTTP 400) the run **fails** with a remediation message instead of resetting
the shared password. Resetting it would revoke the sessions that the release
workflow and the production sign-in workflows are holding.

## Regression protection

- `npx jest tests/smoke-teacher-isolation-contract.test.js` reads the workflow
  files structurally and asserts that each staging smoke workflow declares its
  own dedicated secrets, that both opt into isolation, and that the release
  and production workflows still use the shared identity.
- `npx jest torquemind-api/__tests__/smokeTeacherIdentity.test.js` covers the
  credential resolution rules, the password-reset refusal, and the guards of
  the provisioning helper.
