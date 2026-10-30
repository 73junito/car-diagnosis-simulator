# R26 Phase 2 — R1 membership revalidation: implementation record

**Status: R26 remains PARTIAL.** Route-level revalidation is implemented and tested for the two
owner routes. Direct PostgREST access still bypasses them, and unscoped classes remain governed by
ownership alone.

Builds on R2 (`772e0f19`) without changing its eligibility policy. No migration, grant or RLS
policy is modified.

## 1. The defect

`handleClassRoster` and `handleCreateAssignment` authorised with
`classes.eq('owner_id', auth.user.id)` and then read protected data with a service-role client. RLS
therefore never ran, and class ownership was the last word: an owner who was suspended or revoked
after creating the class kept full access to enrollment rows and student email addresses, and an
owner holding a class in institution B while only belonging to A could read B's students.

Baseline evidence (commit `9636273c`): T5 read the roster of a suspended member's own class → 200;
T5b created an assignment for it → 201.

## 2. What changed

New shared helper `worker/auth/institution-membership.js`:

```js
resolveInstitutionScopeAccess(auth, schoolCode) →
  { allowed: true }                         active membership in the class's institution
  { allowed: true, unscoped: true }         no institution governs the class (F4 deferred)
  { allowed: false, status: 403, reason }   missing, suspended, revoked or foreign
  { allowed: false, status: 503, reason }   lookup failed; fail closed
```

It also exports the two response constants so both routes refuse identically:
`INSTITUTION_ACCESS_REFUSED = 'Class access not permitted'` and
`INSTITUTION_ACCESS_UNAVAILABLE = 'Unable to verify institution membership'`.

Both handlers now select `id,institution_school_code` on the ownership lookup and call the helper
immediately afterwards — before `enrollments`, before `profiles.email`, and before the assignment
insert:

| Route | Gate position |
| --- | --- |
| `GET /api/classes/:classId/students` | after ownership 404, before `enrollments` and `profiles` reads |
| `POST /api/assign` | after ownership 404, before enrollment validation and the `assignments` insert |

`schoolCode` is always `cls.institution_school_code` from the class row; the user is always
`auth.user.id` from the verified token. No request body or query value participates.

Ordering is deliberate: ownership is evaluated first, so a non-owner still receives the existing
404 and learns nothing about institution state, and no membership query is issued for them.

## 3. Approved decisions encoded

| Scenario | Result |
| --- | --- |
| Active member of the class's institution | allowed |
| Missing, suspended or revoked membership | 403 `Class access not permitted` |
| Membership in a different institution only | 403, same body (indistinguishable) |
| Membership query failure | 503, no protected read and no write |
| Unscoped class | unchanged ownership-only access, logged as deferred |
| Non-owner | 404 as before, no membership query |
| Unauthenticated / non-instructor | 401 / 403 as before |

Refusals log the specific reason server-side and return one generic message. The 503 is a
distinct status because it signals a retryable condition; its body still says nothing about
membership state.

## 4. Verification

`tests/r26-institution-membership-revalidation.test.js` — 19 tests, all passing:

| Group | Cases |
| --- | --- |
| roster | T5 (suspended, negative control), T5h (revoked), T5c (positive control), T5d (foreign), T5e (503), T5f (unscoped preserved), T5g (ordering), T5i (non-owner 404) |
| assignment | T5b (suspended, negative control), T5b-revoked, T5c (positive control), T5d (foreign), T5e (503), T5f (unscoped preserved), T5g (ordering), T5i (non-owner 404) |
| preserved | 401 on both routes, 403 for a non-instructor role, existing 400 validation on `/api/assign` |

Every refusal case asserts the *absence* of the protected operation — zero `read:enrollments`, zero
`read:profiles`, zero `insert:assignments` — so a route that declined only after fetching the data
would fail. T5g asserts ordering: the membership read precedes the enrollment read, which precedes
the profile read and the insert.

Negative control: against the unpatched routes **12 of 19 fail** (T5, T5h, T5c roster, T5d roster,
T5e roster, T5g roster, T5b, T5b-revoked, T5c assignment, T5d assignment, T5e assignment, T5g
assignment). T5f and T5i pass in both states by design: they assert behaviour this change
deliberately preserves.

```
npx jest --runTestsByPath tests/r26-institution-membership-revalidation.test.js --runInBand  # 19 passed
npx jest --runTestsByPath <R1 + R2 + 5 adjacent suites> --runInBand                           # 84 passed
npm test                                                                                     # 3061 passed, 46 skipped, 0 failed
npm run test:r22                                                                             # 58/58 assertions
npx eslint worker/auth/institution-membership.js worker/routes/classroom-*.js tests/r26-*     # clean
```

## 5. Unresolved limitations

1. **Direct PostgREST access still bypasses both routes.** No RLS policy is changed here, so a
   client holding the anon key and an instructor JWT can read `enrollments` and `profiles` rows
   through PostgREST by whatever the policies allow, never reaching this revalidation. Roster and
   assignment isolation is route-enforced only, exactly as enrollment isolation is after R2.
2. **Unscoped classes remain ownership-only.** For a class with no `institution_school_code` there
   is nothing to revalidate against, so a revoked independent instructor keeps roster and
   assignment access. This is the F4 gap, not a regression, and the route now logs it explicitly.
3. **No caching layer.** Each request costs one extra indexed membership read. That is the correct
   trade for revalidation — a cache would reintroduce the staleness window this change closes —
   but it does mean roster latency now depends on `institution_memberships`.
4. **Suspension is only as current as the membership row.** If a suspension is written to a
   different table or via a delayed sync, the gate sees the old `active` row. The control is a
   revalidation, not an invalidation.
5. **Unchanged product gaps:** unscoped enrollment still refused (R2/E4), class codes still
   confirm class existence to outsiders, and the client still shows one generic failure message
   for 403 and 503.

## 6. Migration review still required

Before representing the classroom controls as production-ready, two database changes need separate
review, neither implemented here:

1. **Remove the direct self-enrollment path.** `enrollments_insert_self_or_owner` lets any
   authenticated client insert `{class_id, user_id: auth.uid()}` straight through PostgREST. The
   migration must identify any legitimate clients currently relying on it and confirm that
   service-role enrollment through the R2 route still works afterwards.
2. **Confirm the roster and assignment read paths.** Verify which policies on `enrollments`,
   `profiles` and `assignments` are reachable by `authenticated` at all, and whether the
   service-role route remains the only path that returns email addresses.

Until both are closed and verified against a real PostgREST instance, R26 stays **PARTIAL** and the
R21/R22 verdicts stay **UNVERIFIED**.

