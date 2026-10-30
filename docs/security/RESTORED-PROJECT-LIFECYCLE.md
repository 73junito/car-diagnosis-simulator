# Restored Supabase project — temporary lifecycle designation (proposed, not approved)

**Status: proposed. Not approved, not applied.** This document is the record that must be approved
before any change is made to environment `nbgvllelsfhnmuwuqlkw`. Nothing in it is in force until
the approval record in §8 is signed. Until then, no environment protection rule is added, no branch
restriction is applied, no credential is provisioned, and no Supabase user is created.

Base: `main` `505b86ba`. Related work: PR #1128 (draft, head `fd9011fe`), the LMF release HOLD, and
the October 13 staging migration discrepancy — all three are independent of this record and none is
resolved by it.

---

## 1. Purpose

The restored project `nbgvllelsfhnmuwuqlkw` was created to verify the restored database copy. It has
since become the environment for the authenticated-access workstream, and it holds live credentials.
It has never had a recorded owner, a stated retention period, or a deletion date.

This document supplies the missing governance in one place so that three separate decisions can be
made against it deliberately rather than by default:

1. whether the project is retained, and until when;
2. who is accountable for it;
3. what may happen to it, and only with whose authorisation.

It deliberately does **not** authorise anything by itself. It is a proposal awaiting approval.

## 2. Current state — verified facts

Each row below was observed directly; the date and method are given so the claim can be re-checked
rather than trusted.

| Fact | Value | Observed |
|---|---|---|
| Project ref | `nbgvllelsfhnmuwuqlkw` | workflow environment binding |
| Environment protection rules | **0** | GitHub API, 2026-10-29 |
| `can_admins_bypass` | `true` | GitHub API, 2026-10-29 |
| `deployment_branch_policy` | `null` — **no branch restriction** | GitHub API, 2026-10-29 |
| Remote branches able to run the workflow | **731** | `git ls-remote`, 2026-10-29 |
| Environment secrets (names only) | 7 — `ANON_KEY`, `AUTHORIZATION_ENDPOINT`, `DB_PASSWORD`, `JWKS_ENDPOINT`, `OIDC_DISCOVERY`, `RESTORED_TEST_USER_JWT`, `TOKEN_ENDPOINT` | GitHub API metadata, 2026-10-29 |
| Auth settings probe | HTTP 200, `probe: ok` | CI run on `fd9011fe`, 2026-10-29 |
| Email/password provider | enabled (`external.email: true`) | same run |
| Signup | **open** (`disable_signup: false`) | same run |
| Email confirmation | **required** (`mailer_autoconfirm: false`) | same run |
| Authenticated smoke outcome | `NOT_RUN` — `credentials-not-configured` | same run |
| Release evidence | `false` | same run |

Two of these carry more weight than the rest and are stated plainly:

- **`disable_signup: false`.** Anyone who reaches the project's auth endpoint can create an account
  on it. That is a normal setting for a live product and is not a vulnerability in itself. It does,
  however, mean the project accumulates identities over time, and an unowned project that accepts
  signups indefinitely is a liability whose size nobody is measuring.
- **`deployment_branch_policy: null` with 0 protection rules.** Every one of the 731 remote branches
  can run `lmf-restored-supabase-access.yml`, and the run receives all seven environment secrets
  with no approval step and no branch constraint. This is the concrete exposure today, and it is
  larger than the missing reviewer rule that prompted this record.

For context, the same pattern holds repo-wide: of 13 environments, one carries a single protection
rule (a `wait_timer` on `jchfruprqpeypdttvlam_staging`, with `can_admins_bypass: false`), and no
environment anywhere has a `required_reviewers` rule. `main` requires **0** approving reviews. The
gap described here is not specific to this project; it is simply the one that currently holds
credentials.

## 3. Proposed designation

| Field | Proposal | Status |
|---|---|---|
| Designation | Temporary, isolated **verification** environment — not a production or staging destination, and not a source of truth | proposed |
| Accountable owner | `73junito` (repository owner, sole collaborator) | **proposed — requires confirmation** |
| Retention deadline | **2026-11-30** | proposed |
| Days remaining from 2026-10-29 | 32 | arithmetic |
| Decision due at deadline | retain with a renewed written justification, or delete | proposed |
| New credential provisioning | frozen until this record is approved | proposed |
| Production data present | unverified — must be established before deletion is treated as cost-free | **unknown** |

The deadline is deliberately short. It is long enough to finish the authenticated-access
verification, and short enough that the decision is revisited while someone still remembers why the
project exists.

**§7 is deliberately left blank.** A candidate owner is proposed above for discussion, but recording
that name is the approval act this document exists to obtain; entering it as settled here would
defeat the purpose of asking.

## 4. What this designation does and does not authorise

Approving §3 authorises exactly one thing: **the project is retained, under a named owner, until
2026-11-30.** It is a retention decision, not a provisioning decision.

| Action | Authorised by approving this record? |
|---|---|
| Retain the project until 2026-11-30 | yes |
| Name the accountability holder | yes — this is the point of the record |
| Create a dedicated test user in Supabase | **no** — separate authorisation required |
| Create `RESTORED_TEST_USER_EMAIL` / `RESTORED_TEST_USER_PASSWORD` | **no** — separate authorisation required |
| Add or change environment protection rules | **no** — deferred, see §5 |
| Restrict deployment branches | **no** — deferred, see §5 |
| Delete the project | **no** — the deadline triggers a review, not an automatic deletion |
| Delete or rotate `RESTORED_TEST_USER_JWT` (P2 cleanup) | **no** — separate authorisation required |
| Apply the missing October 13 staging migration | **no** — different project, different procedure |
| Any migration, RLS, grant or schema change | **no** |

The distinction matters because the approval is cheap and the next step is not. Approving retention
must not be read as approving provisioning, and this table exists so that reading cannot be mistaken
later.

## 5. Deferred decision — environment reviewer identity

The proposal to add a `required_reviewers` rule to this environment was examined on 2026-10-29 and
**deliberately deferred** until this lifecycle record is approved. The reasoning is recorded here so
the deferral is not mistaken for an oversight.

`73junito` is eligible to be a required reviewer — the repository is public (protection rules are
available on all plans) and the account holds admin. But it is also the **only collaborator**: there
are no other collaborators, no pending invitations, and no organisation that could supply a team
reviewer. Eligibility therefore does not produce independence.

The three achievable configurations behave as follows:

| Configuration | Effect |
|---|---|
| `73junito`, `prevent_self_review: false` | A real manual gate before secrets are released — but the sole administrator approves their own run. A gate, not separation of duties. |
| `73junito`, `prevent_self_review: true`, admins may bypass | Every run waits for an approver who cannot approve, and is cleared by bypass. The rule becomes advisory. |
| `73junito`, `prevent_self_review: true`, admins cannot bypass | **Deadlock.** With one collaborator there is no legal approver, and no path to one. |

The repository's own `environment-protection.yml` hard-codes `prevent_self_review: true` and states
that the reviewer "must be a GitHub account other than the person initiating the protected review".
Applying that standard honestly requires a second human identity with repository access, which is an
access-control decision in its own right — not a workaround to be improvised. Note also that this
workflow targets a different, non-existent environment (`asset-promotion-review` returns 404) and
requires a token with **Administration: write**, so it cannot simply be re-pointed at this project.

The position at the time of writing: **independent approval is preferred over self-approval for an
environment that will hold authentication credentials**, so the reviewer question should be settled
by adding a genuine second reviewer rather than by accepting self-review. That is a decision for
after the lifecycle record is approved.

## 6. Blocked work awaiting approval

| Item | Blocked on | Current state |
|---|---|---|
| Authenticated access verification | dedicated pre-confirmed user + two environment secrets | `NOT_RUN`, `credentials-not-configured` |
| Environment reviewer rule | this record, then a second eligible reviewer | 0 protection rules |
| Deployment branch restriction | this record | unrestricted, 731 branches |
| P2 cleanup of the obsolete JWT secret | separate authorisation after verification | `RESTORED_TEST_USER_JWT` still stored |
| Teardown procedure | this record, and the deadline review | not yet written |

The decisive constraint for the first item is already established and needs no further discovery:
`mailer_autoconfirm: false` means a self-service signup produces an unusable identity, so any test
account must be created **pre-confirmed** through an administrative path. Attempting provisioning by
signup would fail with `email_not_confirmed` rather than succeeding.

## 7. Approval record

This section is intentionally blank. It is to be completed by the accountable owner, not by the
author of this document. Until every field is filled and the decision is recorded in the PR that
introduces this file, this document is a proposal and the environment remains ungoverned.

| Field | Value |
|---|---|
| Decision (retain / delete) | _pending_ |
| Accountable owner | _pending_ |
| Reviewer identity for the environment (see §5) | _pending — deferred_ |
| Retention deadline confirmed as 2026-11-30 | _pending_ |
| Confirmed that the project holds no unique production data | _pending — currently unknown_ |
| Approval date | _pending_ |
| Approving reference (PR / issue / comment link) | _pending_ |

Approval is not implied by merging this file. Merging records the proposal; the approval is the act
of filling this table in a subsequent commit.

## 8. Review at the deadline, and teardown

At 2026-11-30 the owner must choose, in writing, between two options. Silence is not one of them.

**Retain.** Permitted only with a recorded justification, a new deadline, and a statement of what
still requires the project. Retaining indefinitely by inaction is the outcome this record exists to
prevent.

**Delete.** Teardown follows
[SUPABASE-VERIFICATION-ENVIRONMENT-SPEC.md](./SUPABASE-VERIFICATION-ENVIRONMENT-SPEC.md) §9, and
must produce a teardown record — project ref, timestamps, deletion confirmation — rather than a
quiet deletion.
Before deletion is treated as safe, three things must be established, none of which is known today:

1. whether the project holds data that exists nowhere else (copy validation compared the copy to its
   source, which says nothing about whether the source has since moved on);
2. that no evidence referenced by an open gate depends on it remaining reachable — the eight LMF
   release requirements remain pending, not satisfied;
3. that deleting it does not strand a branch or workflow still pointing at the ref. At present
   `lmf-restored-supabase-access.yml` and 731 branches do.

Deleting the project disposes of `DB_PASSWORD` and the stored `RESTORED_TEST_USER_JWT` along with
it; the environment and its secret records would survive and must be removed separately.

## 9. Risks recorded at proposal time

| Risk | Assessment |
|---|---|
| Credentials on an unowned project | The quantified exposure: 7 secrets, released to any of 731 branches, no approval step, no branch restriction |
| Signups accepted indefinitely | `disable_signup: false`; identities accumulate on a project nobody has agreed to operate |
| Deletion destroys the only copy of something | **Unknown.** Not established either way; §8 requires it before deletion |
| Approving retention is read as approving provisioning | Mitigated by §4, which enumerates what approval does *not* cover |
| The deadline passes unobserved | Mitigated only by a named owner in §7; an unnamed owner cannot miss a deadline, because nobody is accountable for it |
| Self-approval mistaken for review | §5 records the distinction explicitly rather than leaving the environment half-protected |

## 10. Status

Proposal only. No environment protection rule added, no branch restriction applied, no credential
provisioned, no Supabase user created, no migration touched. PR #1128 remains draft at `fd9011fe`;
the LMF release HOLD remains active with 8 pending requirements; the October 13 staging migration
discrepancy remains open and independent.

Authenticated restored-project access remains **unverified**. Email/password authentication is
**supported by the reported configuration** (verified 2026-10-29), which is a statement about the
project's advertised settings and not evidence that any identity can sign in.

R21 UNVERIFIED · R22 UNVERIFIED · R26 PARTIAL.
