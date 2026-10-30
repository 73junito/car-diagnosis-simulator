# Restored environment — deployment branch restriction analysis (read-only)

**Status: analysis only. No configuration was changed to produce it, and none is changed by it.**
The environment still has zero protection rules and `deployment_branch_policy: null`. This document
examines what a branch restriction would do before anyone applies one, because the obvious choice —
restrict to `main` — would break the draft PR #1128 check rather than harden it.

Companion to [`RESTORED-PROJECT-LIFECYCLE.md`](./RESTORED-PROJECT-LIFECYCLE.md) (§5 covers the
reviewer question; this covers the branch question). Read-only inputs: the GitHub REST API, the
workflow file at PR #1128 head `fd9011fe`, and the GitHub documentation on deployment branch policies.

---

## 1. Question

Environment `nbgvllelsfhnmuwuqlkw` has no platform-level restriction on which branch may reach it.
Restricting it is an obvious hardening step. The question this analysis answers is narrower and more
awkward: **which branch would you allow, and what happens to the existing workflow when you do?**

## 2. What the environment enforces today

| Layer | Current state | Source |
|---|---|---|
| Protection rules | none — `[]` | GitHub API, 2026-10-29 |
| `deployment_branch_policy` | **`null`** — no policy configured, so no branch is excluded | GitHub API, 2026-10-29 |
| `can_admins_bypass` | `true` | GitHub API, 2026-10-29 |
| Workflow-level guard | job `if:` permits only head ref `feat/lmf-unified-runtime-foundation` (on `pull_request`), or a dispatch on that branch, and only in this repository | workflow file |
| Environments in this repo with a branch policy | 0 of 13 | GitHub API, 2026-10-29 |

The workflow's guard, verbatim from `lmf-restored-supabase-access.yml`:

```yaml
if: >-
  github.repository == '73junito/car-diagnosis-simulator' &&
  ((github.event_name == 'pull_request' &&
    github.event.pull_request.head.repo.full_name == '73junito/car-diagnosis-simulator' &&
    github.event.pull_request.head.ref == 'feat/lmf-unified-runtime-foundation') ||
   (github.event_name == 'workflow_dispatch' &&
    github.ref == 'refs/heads/feat/lmf-unified-runtime-foundation'))
```

That guard is doing real work: it excludes forks, excludes every other branch, and excludes other
repositories. It is also the *only* control, and it lives in the same file that consumes the secrets,
so anyone with write access to that branch can edit the guard and still be handed the seven
environment secrets. The repository does not back it up — `main` requires **0** approving reviews.

## 3. How a deployment branch policy actually behaves

| Property | Behaviour |
|---|---|
| What it applies to | Any workflow job that references the environment. It is not scoped to one workflow. |
| What it is matched against | The **ref of the workflow run**, not the branch you think you are on |
| Pattern syntax | Ruby `File.fnmatch`; `*` and other wildcards **do not match `/`**; to match `release/x/y` you need `release/*/*` |
| `protected_branches: true` | Restricts to branches with branch protection enabled |
| `custom_branch_policies: true` | Restricts to the named patterns you add |
| `null` | No policy — every branch is permitted |
| Who can change it | Tokens/accounts with **Administration: write**; the default `GITHUB_TOKEN` in a workflow is not sufficient |
| Effect of a failed match | The job fails; it is not skipped |

That last row matters for this repository: a blocked job turns a passing check into a **red** one.

## 4. The complication: `pull_request` runs do not carry a branch ref

A run triggered by `pull_request` executes against the merge commit, and the ref it presents is
`refs/pull/<number>/merge` — not `refs/heads/<branch>`.

A public write-up of exactly this failure (praetorian-inc/aurelian PR #250) records the observed
error, after a GitHub change that made branch rules evaluate the merge ref for `pull_request` events:

```
Branch "refs/pull/250/merge" is not allowed to deploy to auto-approve
```

The consequence is counter-intuitive and is the whole point of this document: **a branch policy of
`main` does not merely exclude other branches — it excludes `pull_request` runs entirely**, because
`refs/pull/1128/merge` does not match `main`. So does a policy naming
`feat/lmf-unified-runtime-foundation`, because the PR run is not on that ref either.

**Confidence statement.** The policy mechanics (§3) are documented by GitHub. The `pull_request` ref
behaviour in §4 is reported with an observed error string from a third party, and is *not*
independently reproduced in this repository — reproducing it requires changing the environment's
configuration, which is not authorised. Treat §4 as the strong expectation to verify before applying,
not as a measured result here. §8 gives a way to measure it without touching this environment.

## 5. Which refs this workflow can present

`lmf-restored-supabase-access.yml` has exactly two triggers today: `workflow_dispatch`, and
`pull_request` limited to `branches: [main]` with a `paths` filter. There is no `push` trigger.

| Trigger in use | Ref presented to the environment | Would a `main` policy allow it? |
|---|---|---|
| `pull_request` (head `feat/lmf-unified-runtime-foundation`, base `main`) | `refs/pull/<n>/merge` | **no** |
| `workflow_dispatch` (run from `feat/lmf-unified-runtime-foundation`) | `refs/heads/feat/lmf-unified-runtime-foundation` | **no** |
| `workflow_dispatch` (run from `main`) | `refs/heads/main` | yes |
| `push` to `main` (not configured today) | `refs/heads/main` | yes |

So a `main`-only policy would leave exactly one way to run this workflow: a manual dispatch from
`main`. The workflow file's own guard requires `refs/heads/feat/lmf-unified-runtime-foundation` for
dispatch, so the combination would make the workflow **unrunnable**, not merely restricted. Two
individually reasonable rules compose into a dead workflow — which is why the order of operations
matters more than the choice of pattern.

## 6. Options

| # | Option | Effect on the PR #1128 check | Effect on the other refs | Assessment |
|---|---|---|---|---|
| A | Policy `main` | **Breaks it** — job fails on every PR run | Dispatch from `main` only, which the guard forbids → workflow unusable | Rejected as a first step. This is the option that looks safest and is the most destructive |
| B | Policy `feat/lmf-unified-runtime-foundation` | **Breaks it** — PR runs are on `refs/pull/*/merge` | Dispatch on that branch works | Half-useful; still loses the PR signal |
| C | Policy matching `refs/pull/*/merge` | Allows it | Allows dispatch nowhere | Would permit **every PR in the repository**, and PRs require 0 approvals. Gain is near-zero; pattern acceptance is unverified. Not recommended |
| D | Split the workflow: authenticated step runs in `main` context (`workflow_run` or `push: main`), then apply policy `main` | Preserved for the read-only probes; credentialed step moves off PR context entirely | Works for all remaining triggers | **Most correct.** Matches the GitHub Security Lab two-workflow pattern. Needs its own design and a secrets/trigger change |
| E | Policy `main` **plus** relax the workflow guard to permit dispatch from `main` | Breaks the PR check, keeps a manual path | Usable by hand | Cheap, honest, but abandons PR-time verification |
| F | No policy change; keep the `if:` guard | Unchanged | Unchanged | Status quo; the guard remains the only control, and it is editable by the branch it protects |

Option D is the only one that improves the platform-level control **without** losing a signal the
project relies on. It is also the largest change, and it alters how the password-bearing step is
triggered — which is a security-relevant design decision in its own right, not a configuration tweak.

## 7. Recommendation

**Do not apply a branch policy before splitting the workflow.** Applying `main` first would convert a
passing check into a failing one and, because of the guard/dispatch interaction in §5, would leave no
working way to run the smoke at all. The correct order is:

1. split the authenticated step into a `main`-context workflow (option D), so nothing that needs to
   run on a PR is left depending on a ref a policy will block;
2. verify on a scratch environment (§8) that the policy behaves as §4 predicts;
3. apply the policy to `nbgvllelsfhnmuwuqlkw`, with the allowed patterns derived from what the split
   workflow actually uses;
4. keep `can_admins_bypass` under review at the same time, since a bypassable policy is advisory.


## 8. How to verify §4 without risking PR #1128

Create a **separate, throwaway environment** (for example `branch-policy-probe`), attach a policy of
`main`, and point a scratch workflow at it from a scratch branch. No secrets are needed — an
environment with no secrets still enforces its protection rules. Observe whether the job fails and
capture the exact message. Delete the environment and the scratch branch afterwards.

This answers the `pull_request`-ref question empirically at the cost of one disposable environment
that holds nothing sensitive, and it cannot affect `nbgvllelsfhnmuwuqlkw` or PR #1128. It is still a
configuration change and therefore still needs authorisation.

## 9. Open questions

| Question | Status |
|---|---|
| Does a `pull_request` run really present `refs/pull/N/merge` to the policy in this repository? | **Unverified here** — §8 answers it |
| Would GitHub accept a policy pattern beginning `refs/pull/`? | **Unknown** — option C rests on it and is not recommended regardless |
| Does the project want PR-time verification at all, or is a `main`-context run sufficient? | **Decide before choosing D or E** |
| Should the anon-key probes stay on PRs while the password step moves to `main` context? | Recommended split, not agreed |
| Is disabling PR-time verification acceptable for the credentialed step specifically? | Arguably yes — a password should never be exercised in PR context |

## 10. Status

Analysis only. Environment `nbgvllelsfhnmuwuqlkw` remains at **0** protection rules with
`deployment_branch_policy: null` and **7** secrets; PR #1128 remains draft at `fd9011fe`; the LMF
release HOLD and the October 13 staging migration discrepancy remain open and independent.

R21 UNVERIFIED · R22 UNVERIFIED · R26 PARTIAL.

None of these steps is authorised yet. Steps 1 and 3 change workflow and environment configuration
respectively.
