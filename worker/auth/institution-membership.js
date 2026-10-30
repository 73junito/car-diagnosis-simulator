/**
 * R26 Phase 2 / R1 — institution scope revalidation for owner routes.
 *
 * The classroom routes use a service-role client, so RLS performs no check and the route is the
 * only authorization layer. Class ownership alone is not enough for a record that belongs to an
 * institution: the owner may have been suspended or revoked since the class was created, and an
 * owner whose class lives in institution B while they only hold active membership in A must not
 * reach B's students.
 *
 * The institution code is always read from the class row, never from the request. The acting user
 * is always the verified token identity (`auth.user.id`), never a client-supplied id.
 *
 * Unscoped classes (`institution_school_code IS NULL`) keep their pre-R1 behaviour: ownership is
 * the only available control because no institution governs the record. This is a deliberate
 * deferral pending the F4 product decision, not a reasoned guarantee.
 */

// Returned for every refusal that is about the caller's standing, so a suspended member, a revoked
// member and a foreign member are indistinguishable from the outside.
const INSTITUTION_ACCESS_REFUSED = 'Class access not permitted'

// Infrastructure failure. Discloses nothing about membership state.
const INSTITUTION_ACCESS_UNAVAILABLE = 'Unable to verify institution membership'

const UNRESOLVED_SCOPE_POLICY = 'unscoped_class_access_deferred_to_ownership'

/**
 * Resolves whether the authenticated caller may act on a class record.
 *
 * Returns one of:
 *   { allowed: true }                                  active membership in the class's institution
 *   { allowed: true, unscoped: true }                  no institution governs the class (F4 pending)
 *   { allowed: false, status: 403, reason }            missing, suspended, revoked or foreign
 *   { allowed: false, status: 503, reason }            lookup failed; fail closed
 */
async function resolveInstitutionScopeAccess(auth, schoolCode) {
  if (!schoolCode) return { allowed: true, unscoped: true, reason: UNRESOLVED_SCOPE_POLICY }

  const { data, error } = await auth.supabase
    .from('institution_memberships')
    .select('school_code,status')
    .eq('user_id', auth.user.id)
    .eq('school_code', schoolCode)
    .eq('status', 'active')
    .maybeSingle()

  // Fail closed: an unverifiable membership is never treated as membership.
  if (error) return { allowed: false, status: 503, reason: 'membership_lookup_failed' }
  if (!data) return { allowed: false, status: 403, reason: 'no_active_institution_membership' }

  return { allowed: true, schoolCode: data.school_code }
}

export {
  resolveInstitutionScopeAccess,
  INSTITUTION_ACCESS_REFUSED,
  INSTITUTION_ACCESS_UNAVAILABLE,
  UNRESOLVED_SCOPE_POLICY
}
