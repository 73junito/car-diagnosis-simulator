# LMF database verification — unreviewed technical evidence

**Classification: UNREVIEWED TECHNICAL EVIDENCE — NOT RELEASE APPROVAL**

This record preserves the outcome of one successful CI execution of the LMF database harnesses,
written because the original logs expire. It is a sanitised observation, not an evidence bundle, and
it confers no approval. No release gate is satisfied by anything on this page.

---

## 1. Evidence classification

| Question | Answer |
|---|---|
| What is this? | A durable summary of one green CI run of two database harnesses |
| Is it reviewable evidence? | Yes — the run URL is recorded in §2 and was live when this was written |
| Does it approve a release gate? | **No** |
| Has an independent reviewer examined it? | **No** — see §7 |
| Does it prove Supabase equivalence? | **No** — see §5 |
| Does it replace the CI logs? | **No** — it preserves the reported result, not the logs (§6) |

## 2. Source

| Field | Value |
|---|---|
| Workflow | `LMF Database Verification` (`.github/workflows/lmf-db-verification.yml`) |
| Run | https://github.com/73junito/car-diagnosis-simulator/actions/runs/41249113902 |
| Job | https://github.com/73junito/car-diagnosis-simulator/actions/runs/41249113902/job/124678702408 |
| **Commit the run executed on** | **`fd6dd6ad901b5719bacb886f6a14c5e55c4ba5db`** |
| Trigger | `pull_request` against `main` |
| Started / completed | 2026-10-31T22:38:48Z / 2026-10-31T22:39:46Z |
| Conclusion | `success`, run attempt 1 |
| PostgreSQL | **14** (`docker.io/library/postgres:14`), service container |
| Runner | GitHub-hosted `ubuntu-24.04` |

The commit above is the SHA GitHub reports for this run, read back from the API rather than assumed.
It happened to also be the pull-request head when this document was written, but that coincidence is
not what makes it evidence: the run's own `head_sha` does.

**Later commits are not this evidence.** The commit that adds this document sits on top of that run's
SHA; it documents the run, it does not re-execute it. Any future re-run produces a new run ID and
must be recorded separately.

## 3. Verified results

Both lines below were read from the job log and reproduced verbatim, including wording and
punctuation:

```
PASS: two parallel first appends -> one accepted, one rejected; correct chain continuation.
PASS: PostgreSQL persisted v1 and v2 signatures, key rotation, verified chain and retired-key denial
```

Disposable database cleanup was reported at the end of the job:

```
Disposable databases dropped; the service container is discarded with the job.
```

All fourteen steps of the job concluded `success`, including `Create databases and apply shim plus
LMF migrations`, both harness steps, and `Tear down disposable databases`.

## 4. Test scope

**Schema preparation.** Two databases, `lmf_concurrency_verify` and `lmf_rotation_verify`, are
created inside the container. A minimal Supabase compatibility shim supplies the `anon`,
`authenticated` and `service_role` roles, the `auth` schema, `auth.users` and `auth.uid()`/`auth.jwt()`
— none of which a bare PostgreSQL image provides. The two LMF migrations
(`20261024212822_lmf_reference_evidence_access.sql`, `20261024213613_lmf_atomic_reference_append.sql`)
are then applied to each database.

**Concurrent append.** The harness opens **three** simultaneous client connections, then issues two
first-appends for the same session and sequence number in parallel. It asserts that exactly one
succeeds, that exactly one is rejected, that the table holds exactly one row afterwards, that a
second append with the correct previous hash is accepted, and that the final count is two. The
appends go through `lmf_private.append_reference_event()`, which takes the session row `FOR UPDATE`,
rejects a stale or broken chain, and relies on a uniqueness constraint — so the race is resolved by
the database, not by the test.

**Key rotation and signature chain.** The rotation harness writes one event under signing key `v1`
and a second under `v2`, then verifies for each row that the sequence increments, that
`previous_hash` equals the prior `event_hash`, that the recorded `signingKeyId` matches the expected
key, and that the signature verifies against that key. It then verifies that the `v1` signature is
**rejected** by a keyring holding only `v2` — the retired-key denial.

**What these tests do not establish.** The append test demonstrates this specific compare-and-append
contract; it is not a general proof of serializability under production load. Signature verification
covers the chain built by these two writes; it is not a migration of an existing production chain.

## 5. Limitations

| Limitation | Detail |
|---|---|
| PostgreSQL version | Tests ran on **14**. Staging and production run **17** (Supabase `postgres:17.6.x`). This is a real version gap, not a formatting detail |
| Why 14 | `scripts/verify-ci-postgres-service-image.js` pins the approved CI image to `postgres:14`; the repository's enforced policy was followed rather than changed |
| Compatibility shim | The `auth` schema, roles and `auth.uid()` used here are hand-built stand-ins, **not Supabase-managed PostgreSQL**. Nothing in the shim exercises Supabase's own auth stack, triggers, extensions or connection pooling |
| Supabase equivalence | **Not demonstrated.** A green run on a plain container says nothing about RLS behaviour under Supabase's real roles and JWT claims, nor about managed extensions |
| Schema coverage | Only the two LMF migrations are applied. The other 107 canonical migrations, the full RLS surface and the application schema are absent |
| RLS behaviour | The harnesses connect as a superuser, which bypasses row security. Ownership policies on `lmf_reference_sessions` / `lmf_reference_events` are therefore not exercised by these assertions |
| Independent review | **None has occurred.** No human has inspected this run beyond confirming that it is green |
| Gate status | `P1-concurrent-append` and `P1-crypto-replay` remain **`pending`**. So do the other six. All eight release gates are unresolved |

## 6. Evidence retention

| Field | Value |
|---|---|
| GitHub Actions log retention | **90 days** — GitHub's default. The REST API for this repository does **not** expose the configured value (`actions/permissions` returns only `allowed_actions`, `enabled`, `sha_pinning_required`), so this figure is the documented default rather than a verified setting |
| Retained artifacts from this run | **0** |
| Run created | 2026-10-31 |
| Approximate log expiry | **2027-01-29** (90 days after the run; approximate because the retention setting is unverified) |
| What expires | The job logs. The run record and its conclusion persist; the log text does not |

This document preserves a **sanitised observation of the result** — two PASS lines, a cleanup line,
and the metadata in §2. It does not preserve the original executable logs, the full step-by-step
output, the container's own logs, or a reproducible evidence bundle. When the logs expire, the
assertion that these tests passed rests on this page and on the run record alone.

Reproduction is available rather than reconstruction: re-running the workflow (a pull request touching
the workflow's path filters, or `workflow_dispatch`) executes the same harnesses again and produces a
new run with a new ID. That new run would need its own record; it does not inherit this one.

## 7. Governance

| Item | Status |
|---|---|
| Independent reviewer | **PENDING** — a non-author reviewer has not examined this evidence |
| Evidence approval | **PENDING** — no gate may be marked `passed` without a named reviewer and review date |
| Release authorization | **NOT GRANTED** |
| `data/lmf/release-evidence.json` | Unchanged by this document; all eight gates `pending` |
| Release HOLD | **ACTIVE** |

The eight gates, all `pending`: `P0-authentication`, `P0-migration-parity`, `P1-tenant-isolation`,
`P1-concurrent-append`, `P1-crypto-replay`, `P1-independent-review`, `P2-load-and-recovery`,
`P2-observability-rollback`.

Why this page cannot clear anything by itself: the gate policy requires every accepted gate to carry
a commit SHA, an HTTPS evidence URL, a **named reviewer** and a review date, and it explicitly
forbids approving a release by self-review or stub evidence. A run URL is one of four required
elements; the other three are governance acts, not test outputs.

R21 UNVERIFIED · R22 UNVERIFIED · R26 PARTIAL.

