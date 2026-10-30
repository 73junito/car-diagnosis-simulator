# R26 Phase 2 — R2 enrollment eligibility: implementation record

**Status: R26 remains PARTIAL.** The route-level control is implemented and tested. The
database-level bypass is **not** closed and is an explicitly unresolved security gap.

Plan: `R26-PHASE2-R2-ENROLLMENT-ELIGIBILITY-PLAN.md` (committed immediately before this change).
Baseline evidence where T8 and T8b failed with 201: commit `9636273c`, branch
`audit/r26-phase2-route-authz`.

## 1. Approved policy (E2-only)

Active institution membership is the **minimum** eligibility requirement for enrollment in an
institution-scoped class. It is not proof that a student was individually invited or approved for
a specific class, and it is not a substitute for per-class authorization.

| Scenario | Result |
| --- | --- |
| Active member of institution A enrolls in a class in A | allow, with a valid class code |
| Active member of A attempts enrollment in B | deny, 403 |
| Unaffiliated user attempts institution-scoped enrollment | deny, 403 |
| Inactive, suspended or revoked member | deny, 403 |
| Institution membership lookup fails | fail closed, 503 |
| Enrollment in an unscoped class | deny pending the F4 product decision |
| User already enrolled | unchanged idempotent behaviour (200 + `already_enrolled`) |

Membership is always resolved from the **server-verified** `auth.user.id` and the **class's own**
`institution_school_code`. No client-supplied user id, school code, or target-institution field is
read on this path.

## 2. What changed

`worker/routes/classroom-classes.js` only, 45 added lines:

1. `handleEnrollInClass` now selects `id,class_code,institution_school_code` for the class.
2. A new module-local `resolveEnrollmentEligibility(auth, cls)` returns
   `{ allowed: true, schoolCode }` or `{ allowed: false, reason[, status] }`:
   - no `institution_school_code` → refuse (`unscoped_enrollment_not_permitted`), no membership
     query is issued;
   - otherwise one `institution_memberships` read filtered by `user_id`, `school_code` and
     `status = 'active'`;
   - lookup error → `{ status: 503, reason: 'eligibility_lookup_failed' }`;
   - no row → refuse (`no_active_institution_membership`).
3. The gate runs after authentication, class lookup, and the exact class-code comparison, and
   **strictly before** the service-role insert. 403 responses are a single generic
   `Enrollment not permitted`; the specific reason is logged server-side only. 503 responses say
   `Unable to verify enrollment eligibility`, which discloses nothing about membership state.

Preserved unchanged: bearer-token verification, `Instructor access required` on owner routes,
405/400/404 handling, wrong-code 403, `23505` → `already_enrolled` 200, and the
`Unable to enroll in class` 500 paths.

## 3. Verification

`tests/r26-enrollment-eligibility.test.js` — 18 tests, all passing:

| Group | Cases |
| --- | --- |
| matrix | T8, T8b, T8c (positive control), T8d, T8e |
| edge cases | T8f, T8g, T8h, T8i (idempotency preserved), T8j (client fields ignored), T8k (ordering) |
| preserved | 401, 405, 400, 404, wrong-code 403 with no membership query, class-lookup 500, code normalization |

The suite asserts the *absence* of the write, not just the status: T8, T8b, T8d, T8e, T8f, T8g, T8h
and T8j additionally check that no `enrollments` insert was attempted and that the row count did
not change. T8k asserts the membership read is positioned before the insert in the operation
journal, so a future refactor that moves the check after the write fails the test.

Negative control: against the unpatched route, **10 of the 18 tests fail** (T8, T8b, T8c, T8d,
T8e, T8f, T8g, T8h, T8j, T8k). The expectations were not adjusted to the new behaviour.

```
npx jest --runTestsByPath tests/r26-enrollment-eligibility.test.js --runInBand   # 18 passed
npm test                                                                        # 3042 passed, 46 skipped, 0 failed
                                                                                # + 14 Supabase contract assertions
npx eslint worker/routes/classroom-classes.js tests/r26-enrollment-eligibility.test.js  # clean
```

Adjacent suites re-run and unchanged: `worker-classroom-classes-contract`,
`worker-classroom-assignments-contract`, `institution-tenant-foundation`,
`institution-tenant-isolation-suite`, `g2-classroom-isolation-closeout` (47 passed).

## 4. Unresolved security gap — direct PostgREST self-enrollment

**This route fix is not complete protection for the enrollment tables.** The policy
`enrollments_insert_self_or_owner` still permits any client holding the anon key and a user JWT to
insert `{ class_id, user_id: auth.uid() }` directly through PostgREST, bypassing every check added
here. The R22 harness records that policy as effective, so the bypass is reachable, not theoretical.

The two layers now disagree: the route requires institution membership, the database requires only
self-ownership. Closing this needs a reviewed migration — the smallest adequate change is to drop
the self-insert policy so enrollment becomes service-role-only and this route is the single
decision point. That is deliberately **not** done here: no migration, grant, or RLS policy is
modified by this change, and R22 remains UNVERIFIED because the PostgREST equivalence check still
needs the disposable Supabase project.

Until that migration lands, treat R26 enrollment isolation as **route-enforced only**.

## 5. Compatibility limitations

1. **Unscoped classes can no longer be joined through the API.** An instructor with no institution
   membership creates a class with `institution_school_code = null`
   (`resolveInstructorInstitution` returns `schoolCode: null` for zero memberships), and such
   classes are now refused at enrollment. This is the approved E4 behaviour, and it is a
   user-visible regression for independent-instructor classes until F4 defines a mechanism.
2. **Membership is now a prerequisite for students.** A student whose institution membership row is
   missing, pending, or inactive loses the ability to join, even with a correct code. Intentional,
   and the main candidate for support load on rollout.
3. **Class codes still confirm class existence to outsiders.** `GET /api/classes/by-code/:code`
   is unchanged, so an unaffiliated authenticated user can verify a code and obtain the class name
   and id. Enrollment is refused, but code enumeration is not rate-limited. Proposed follow-up.
4. **Client UX cannot distinguish refusal from failure.** `apiPost` in `script.js` returns `null`
   for every non-2xx, so the 403 and the 503 both surface as `Failed to join class.` No
   information leaks, but a transient 503 invites no retry.
5. **Membership roles are not distinguished.** Any active membership satisfies E2, including a
   student `member` row for a class owned by an instructor of the same institution. Per-class
   enrollment control (invitations) remains a separate, unapproved change.

