# R26 Phase 2 — R2 enrollment eligibility: implementation plan (NOT implemented)

**Status: design only.** No production route, migration, grant or RLS policy is changed.
Companion to `R26-PHASE2-ROUTE-AUTHZ-AUDIT.md` and `R26-PHASE2-REMEDIATION-PROPOSALS.md`.
R26 remains **PARTIAL**.

Baseline evidence: `tests/r26-phase2-authorization-matrix.evidence.js` (commit `9636273c`) —
T8 and T8b currently fail with **201**: a cross-institution student and a wholly unaffiliated user
both enrolled successfully using nothing but a 6-character class code.

## 1. What is wrong today

`handleEnrollInClass` (`worker/routes/classroom-classes.js:240`) performs exactly three checks: a
bearer token, `classId` resolving to a real class, and `body.code === cls.class_code`. It then
inserts `{ class_id, user_id: auth.user.id }` with the service-role client.

Possession of a class code is therefore treated as eligibility. No institution is consulted, no
membership is required, and no class-invitation concept exists in the schema — the only invitation
tables are for *institution membership*.

The database cannot compensate: `enrollments_insert_self_or_owner` permits `user_id = auth.uid()`
with no invitation check (R22 §6b), and the service-role client bypasses RLS entirely. Both layers
currently permit the same thing.

## 2. Eligibility policy to be reviewed

| # | Rule | Rationale |
| --- | --- | --- |
| E1 | A class code identifies a class; it never establishes eligibility | removes the current conflation |
| E2 | For an **institution-scoped** class, the caller must hold an **active** membership in that institution | institution records are governed by institution membership |
| E3 | An explicit grant (invitation) is additionally required **if** the product rule is invite-only; if the rule is "any active member may join", E2 alone suffices | the decision the review must make |
| E4 | For an **unscoped** class, enrolment requires an instructor-issued grant. Until that exists, unscoped enrolment is **refused** | fail closed rather than inherit the open code model |
| E5 | If eligibility cannot be established — lookup error, missing row, ambiguous state — refuse, and distinguish that in server logs only | no accidental allow on infrastructure failure |
| E6 | Refusals return one generic message (`Enrollment not permitted`) plus a specific server-side reason code | no membership oracle |

### Two viable product rules for E3

| Rule | Behaviour | Cost | Consequence |
| --- | --- | --- | --- |
| **E2-only** | any active member of institution A may join any class in A with its code | no schema change | codes still spread *within* an institution; cross-institution and unaffiliated paths close |
| **E2 + invitation** | a per-(class, user) grant issued by an instructor or admin | needs a table + migration | tightest; matches "explicit enrolment authorization mechanism" |

Recommendation: ship **E2-only first** — it closes T8/T8b with no migration and no product-risk —
then add invitations as a separate reviewed change if per-class control is wanted.

## 3. Implementation outline (route only, no schema change)

```js
// classroom-classes.js — after the class lookup and code comparison, before insert
const eligibility = await resolveEnrollmentEligibility(auth, cls)
if (!eligibility.allowed) {
  console.warn('Enrollment refused:', eligibility.reason, { classId: cls.id, userId: auth.user.id })
  return c.json({ error: 'Enrollment not permitted' }, eligibility.status ?? 403)
}
```

`resolveEnrollmentEligibility(auth, cls)` — new module-local helper:

1. `if (!cls.institution_school_code) return { allowed: false, reason: 'unscoped_enrollment_not_permitted' }` (E4)
2. query `institution_memberships` for `user_id = auth.user.id`, `school_code = cls.institution_school_code`,
   `status = 'active'` — same pattern as `resolveInstructorInstitution` but **without** the
   instructor-role filter, because a student member is legitimate here
3. `if (error) return { allowed: false, status: 503, reason: 'eligibility_unavailable' }` (E5)
4. `if (!row) return { allowed: false, reason: 'no_active_membership' }` (E2)
5. `return { allowed: true, schoolCode: row.school_code }`

Preserved behaviour: the 401 path, the 404 for an unknown class, the 403 for a wrong code, and the
idempotent `23505 → already_enrolled` branch — eligibility is evaluated *before* the insert, so a
re-enrolment attempt by an ineligible user stays refused.

## 4. Database follow-up (proposed, not implemented)

The route fix alone leaves the PostgREST path open for any client holding the anon key. Options, in
order of preference:

1. **Drop `enrollments_insert_self_or_owner`** so enrolment is service-role-only and the route is
   the single decision point. Small migration, no data or grant change.
2. Replace it with a policy requiring a server-written eligibility marker (needs E3 invitations).
3. Keep the policy and add a `before insert` trigger calling a shared eligibility function — most
   robust, most invasive, hardest to test locally.

Option 1 is the smallest change that makes the two layers agree. It is a migration and therefore
**out of scope for this phase**.

## 5. Negative tests this plan must satisfy

T8 and T8b keep their current expectations **unchanged** — they flip from FAIL to PASS because the
code changed, never because the assertion moved.

| ID | Case | Expected after remediation |
| --- | --- | --- |
| T8 | student of A enrols in a class in B with B's code | 403 *(currently 201)* |
| T8b | unaffiliated user enrols with only a code | 403 *(currently 201)* |
| T8c | **active member of the class's institution enrols with the code** | 201 — positive control for the fix |
| T8d | membership exists but `status = 'suspended'` | 403 |
| T8e | membership lookup returns an error | 503, never 201 |
| T8f | caller is a member of a *different* institution | 403 |
| T8g | class is unscoped | 403 pending the E4 decision |
| T8h | re-enrolment by an ineligible user where the row already exists | 403, not the idempotent 200 |

T8c is the control the current suite lacks. Without it, a "fix" that refuses **everyone** would
look green on T8/T8b alone — the same failure mode as a smoke test that asserts nothing.

## 6. R1 outline — membership revalidation (to be designed in full afterwards)

Same shape, different routes. For `handleClassRoster` and `handleCreateAssignment`, after loading
the class:

- `institution_school_code IS NULL` → owner-only authorization (unchanged; F4 pending);
- otherwise require an **active** membership in `class.institution_school_code` for the acting user,
  accepting instructor/institution_admin/institution_owner roles, before reading enrollments or
  profiles or inserting an assignment;
- membership lookup error → 503, fail closed;
- one membership query per request, reused by both checks, to avoid an N+1 in future batch routes.

It must run **before** the roster's `enrollments` and `profiles.email` reads — the point of
revalidation is to stop the PII read, not to report after it. Tests: T5/T5b flip to PASS; add
T5c (membership row deleted entirely), T5d (lookup error → 503), T5e (positive control: active
member reads own roster → 200).

## 7. Sequencing

1. Review and approve the E3 rule (E2-only vs E2+invitation).
2. Implement `resolveEnrollmentEligibility` + tests T8c–T8h; T8/T8b flip to PASS.
3. Review the RLS option-1 migration separately.
4. Then R1, with T5/T5b flipping and T5c–T5e added.
5. Once a suite is green, promote those cases from the `.evidence.js` file into the required
   `unit-tests` job as ordinary regression checks.

