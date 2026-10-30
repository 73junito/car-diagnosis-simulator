/** @jest-environment node */
/**
 * R26 Phase 2 / R2 — enrollment eligibility regression suite (E2-only policy).
 *
 * Approved policy: active institution membership is the MINIMUM eligibility requirement for
 * enrollment in an institution-scoped class. It is not proof that a student was individually
 * invited or approved for a specific class.
 *
 * This file replaces the corresponding baseline cases from
 * `tests/r26-phase2-authorization-matrix.evidence.js` in `audit/r26-phase2-route-authz`
 * (commit 9636273c), where T8 and T8b failed with 201. The expectations are identical: they
 * flip to PASS because the route changed, not because an assertion was relaxed.
 *
 * Unresolved and deliberately out of scope: `enrollments_insert_self_or_owner` still permits a
 * direct PostgREST self-enrollment that never passes through this route. The route fix is NOT
 * complete protection for the enrollment table; closing the PostgREST path needs a reviewed
 * migration. See docs/security/R26-PHASE2-R2-ENROLLMENT-ELIGIBILITY.md.
 *
 * The mocked Supabase client grants full service-role capability and records the order of
 * operations, so a failure means the route allowed the operation rather than the database
 * rejecting it.
 */

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))
jest.mock('../api/_utils/auth-utils.js', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseToken: jest.fn()
}))

const { createClient } = require('@supabase/supabase-js')
const { extractBearerToken, verifySupabaseToken } = require('../api/_utils/auth-utils.js')
const { handleEnrollInClass } = require('../worker/routes/classroom-classes.js')

const SCHOOL_A = 'ZZA001'
const SCHOOL_B = 'ZZB002'
const CLASS_A = 'class-in-a'
const CLASS_B = 'class-in-b'
const CLASS_UNSCOPED = 'class-unscoped'
const CODE_A = 'AAA111'
const CODE_B = 'BBB222'
const CODE_UNSCOPED = 'UUU999'

const MEMBER_A = { id: 'student-a', app_metadata: { role: 'student' } }
const MEMBER_B_SUSPENDED = { id: 'student-b-suspended', app_metadata: { role: 'student' } }
const UNAFFILIATED = { id: 'unaffiliated', app_metadata: { role: 'student' } }

let idCounter = 0

function makeWorld(overrides = {}) {
  return {
    institution_memberships: [],
    classes: [
      { id: CLASS_A, name: 'Class in A', owner_id: 'owner-a', class_code: CODE_A, institution_school_code: SCHOOL_A },
      { id: CLASS_B, name: 'Class in B', owner_id: 'owner-b', class_code: CODE_B, institution_school_code: SCHOOL_B },
      {
        id: CLASS_UNSCOPED,
        name: 'Independent class',
        owner_id: 'owner-independent',
        class_code: CODE_UNSCOPED,
        institution_school_code: null
      }
    ],
    enrollments: [],
    ...overrides
  }
}

/**
 * Service-role-capable fake client. `journal` records `read:<table>` and `insert:<table>`
 * events so ordering can be asserted; `errors` injects a per-table error result.
 */
function makeClient(world, journal = [], errors = {}) {
  return {
    from(table) {
      const state = { filters: [], payload: null }
      const rows = () => world[table] || (world[table] = [])
      const matching = () => rows().filter((row) => state.filters.every((fn) => fn(row)))

      const settle = () => {
        if (state.payload) {
          const incoming = Array.isArray(state.payload) ? state.payload : [state.payload]
          const duplicate = incoming.find((candidate) =>
            rows().some((row) => Object.entries(candidate).every(([key, value]) => String(row[key]) === String(value)))
          )
          if (duplicate) {
            return {
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' }
            }
          }
          const inserted = incoming.map((row) => ({ id: `gen-${++idCounter}`, ...row }))
          rows().push(...inserted)
          return { data: inserted, error: null }
        }
        return { data: matching(), error: null }
      }

      const read = () => {
        journal.push(`read:${table}`)
        if (errors[table]) return { data: null, error: errors[table] }
        return settle()
      }

      const builder = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        eq: (column, value) => {
          state.filters.push((row) => String(row[column]) === String(value))
          return builder
        },
        in: (column, values) => {
          const set = new Set((values || []).map(String))
          state.filters.push((row) => set.has(String(row[column])))
          return builder
        },
        insert: (payload) => {
          journal.push(`insert:${table}`)
          state.payload = payload
          return builder
        },
        maybeSingle: () => {
          const result = read()
          return Promise.resolve({
            data: result.error ? null : result.data[0] ?? null,
            error: result.error ?? null
          })
        },
        single: () => {
          if (state.payload) {
            journal.push(`read:${table}`)
            const result = errors[table]
              ? { data: null, error: errors[table] }
              : settle()
            return Promise.resolve({
              data: result.error ? null : result.data[0] ?? null,
              error: result.error ?? null
            })
          }
          const result = read()
          return Promise.resolve({
            data: result.error ? null : result.data[0] ?? null,
            error: result.error ?? null
          })
        },
        then: (resolve, reject) => Promise.resolve(read()).then(resolve, reject)
      }
      return builder
    }
  }
}


function makeContext({ method = 'POST', params = {}, body = null, token = 'valid-token' } = {}) {
  return {
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key'
    },
    req: {
      method,
      header: (name) => (String(name).toLowerCase() === 'authorization' && token ? `Bearer ${token}` : null),
      param: (name) => params[name],
      json: async () => {
        if (body === null) throw new Error('no body')
        return body
      }
    },
    json: (payload, status = 200) => ({ payload, status })
  }
}

function session(user) {
  extractBearerToken.mockReturnValue('valid-token')
  verifySupabaseToken.mockResolvedValue({ user, error: null })
}

function arrange(worldOverrides = {}, clientOptions = {}) {
  const world = makeWorld(worldOverrides)
  const journal = []
  createClient.mockReturnValue(makeClient(world, journal, clientOptions.errors || {}))
  return { world, journal }
}

function enroll({
  classId = CLASS_B,
  code = CODE_B,
  user = UNAFFILIATED,
  body = null,
  token = 'valid-token',
  method = 'POST'
} = {}) {
  if (token) session(user)
  else extractBearerToken.mockReturnValue(null)
  return handleEnrollInClass(
    makeContext({
      method,
      params: { classId },
      body: body === null ? { code } : body,
      token
    })
  )
}

const insertAttempts = (journal) => journal.filter((entry) => entry === 'insert:enrollments').length
const eligibilityReads = (journal) => journal.filter((entry) => entry === 'read:institution_memberships').length

beforeEach(() => {
  jest.clearAllMocks()
  idCounter = 0
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})


// ---------------------------------------------------------------------------
// T8-T8h: the approved E2-only eligibility matrix
// ---------------------------------------------------------------------------
describe('R26 R2 enrollment eligibility matrix', () => {
  test('T8 a member of institution A cannot enroll in an institution B class using B\'s code', async () => {
    const { world, journal } = arrange({
      institution_memberships: [
        { school_code: SCHOOL_A, user_id: MEMBER_A.id, role: 'member', status: 'active' }
      ]
    })

    const res = await enroll({ classId: CLASS_B, code: CODE_B, user: MEMBER_A })

    expect(res.status).toBe(403)
    expect(res.payload.error).toBe('Enrollment not permitted')
    expect(insertAttempts(journal)).toBe(0)
    expect(world.enrollments).toHaveLength(0)
  })

  test('T8b an unaffiliated user cannot enroll with only a valid class code', async () => {
    const { world, journal } = arrange()

    const res = await enroll({ classId: CLASS_B, code: CODE_B, user: UNAFFILIATED })

    expect(res.status).toBe(403)
    expect(res.payload.error).toBe('Enrollment not permitted')
    expect(insertAttempts(journal)).toBe(0)
    expect(world.enrollments).toHaveLength(0)
  })

  test('T8c [positive control] an active member of A enrolls in an A class with A\'s code', async () => {
    const { world, journal } = arrange({
      institution_memberships: [
        { school_code: SCHOOL_A, user_id: MEMBER_A.id, role: 'member', status: 'active' }
      ]
    })

    const res = await enroll({ classId: CLASS_A, code: CODE_A, user: MEMBER_A })

    expect(res.status).toBe(201)
    expect(res.payload.success).toBe(true)
    expect(res.payload.enrollment).toMatchObject({ class_id: CLASS_A, user_id: MEMBER_A.id })
    expect(world.enrollments).toHaveLength(1)
    expect(world.enrollments[0]).toMatchObject({ class_id: CLASS_A, user_id: MEMBER_A.id })
    expect(eligibilityReads(journal)).toBe(1)
  })

  test('T8d a suspended institution member is refused', async () => {
    const { world, journal } = arrange({
      institution_memberships: [
        { school_code: SCHOOL_B, user_id: MEMBER_B_SUSPENDED.id, role: 'member', status: 'suspended' }
      ]
    })

    const res = await enroll({ classId: CLASS_B, code: CODE_B, user: MEMBER_B_SUSPENDED })

    expect(res.status).toBe(403)
    expect(res.payload.error).toBe('Enrollment not permitted')
    expect(insertAttempts(journal)).toBe(0)
    expect(world.enrollments).toHaveLength(0)
  })

  test('T8e a failed membership lookup fails closed with 503 and never inserts', async () => {
    const { world, journal } = arrange(
      {
        institution_memberships: [
          { school_code: SCHOOL_B, user_id: MEMBER_A.id, role: 'member', status: 'active' }
        ]
      },
      { errors: { institution_memberships: { message: 'connection reset', code: '08006' } } }
    )

    const res = await enroll({ classId: CLASS_B, code: CODE_B, user: MEMBER_A })

    expect(res.status).toBe(503)
    expect(res.payload.error).toBe('Unable to verify enrollment eligibility')
    expect(insertAttempts(journal)).toBe(0)
    // A membership row exists in the world; an unverifiable lookup must not be read as one.
    expect(world.enrollments).toHaveLength(0)
  })
})


describe('R26 R2 enrollment eligibility edge cases', () => {
  test('T8f an active membership in A never authorizes a class in B, even alongside a revoked B membership', async () => {
    const { world, journal } = arrange({
      institution_memberships: [
        { school_code: SCHOOL_A, user_id: MEMBER_B_SUSPENDED.id, role: 'member', status: 'active' },
        { school_code: SCHOOL_B, user_id: MEMBER_B_SUSPENDED.id, role: 'member', status: 'revoked' }
      ]
    })

    const res = await enroll({ classId: CLASS_B, code: CODE_B, user: MEMBER_B_SUSPENDED })

    expect(res.status).toBe(403)
    expect(insertAttempts(journal)).toBe(0)
    expect(world.enrollments).toHaveLength(0)
  })

  test('T8g enrollment in an unscoped class is refused pending the F4 decision', async () => {
    const { world, journal } = arrange({
      institution_memberships: [
        { school_code: SCHOOL_A, user_id: MEMBER_A.id, role: 'member', status: 'active' }
      ]
    })

    const res = await enroll({ classId: CLASS_UNSCOPED, code: CODE_UNSCOPED, user: MEMBER_A })

    expect(res.status).toBe(403)
    expect(res.payload.error).toBe('Enrollment not permitted')
    expect(insertAttempts(journal)).toBe(0)
    // No institution governs an unscoped class, so no membership lookup is meaningful.
    expect(eligibilityReads(journal)).toBe(0)
    expect(world.enrollments).toHaveLength(0)
  })

  test('T8h an already-enrolled user is still refused once no longer eligible', async () => {
    const { world, journal } = arrange({
      institution_memberships: [
        { school_code: SCHOOL_A, user_id: MEMBER_A.id, role: 'member', status: 'active' }
      ],
      enrollments: [{ id: 'enr-existing', class_id: CLASS_B, user_id: MEMBER_A.id }]
    })

    const res = await enroll({ classId: CLASS_B, code: CODE_B, user: MEMBER_A })

    expect(res.status).toBe(403)
    expect(res.payload.already_enrolled).toBeUndefined()
    expect(insertAttempts(journal)).toBe(0)
    expect(world.enrollments).toHaveLength(1)
  })

  test('T8i [preserved] an eligible already-enrolled user keeps the idempotent 200 response', async () => {
    const { world } = arrange({
      institution_memberships: [
        { school_code: SCHOOL_A, user_id: MEMBER_A.id, role: 'member', status: 'active' }
      ],
      enrollments: [{ id: 'enr-existing', class_id: CLASS_A, user_id: MEMBER_A.id, created_at: '2026-01-01' }]
    })

    const res = await enroll({ classId: CLASS_A, code: CODE_A, user: MEMBER_A })

    expect(res.status).toBe(200)
    expect(res.payload.already_enrolled).toBe(true)
    expect(res.payload.enrollment.id).toBe('enr-existing')
    expect(world.enrollments).toHaveLength(1)
  })

  test('T8j client-supplied identity or institution fields cannot authorize enrollment', async () => {
    const { world, journal } = arrange({
      institution_memberships: [
        { school_code: SCHOOL_A, user_id: MEMBER_A.id, role: 'member', status: 'active' }
      ]
    })

    const res = await enroll({
      classId: CLASS_B,
      code: CODE_B,
      user: MEMBER_A,
      body: {
        code: CODE_B,
        user_id: 'victim-user',
        userId: 'victim-user',
        schoolCode: SCHOOL_B,
        institution_school_code: SCHOOL_B
      }
    })

    expect(res.status).toBe(403)
    expect(insertAttempts(journal)).toBe(0)
    expect(world.enrollments).toHaveLength(0)
  })

  test('T8k eligibility is resolved before the service-role insert, never after it', async () => {
    const { journal } = arrange({
      institution_memberships: [
        { school_code: SCHOOL_A, user_id: MEMBER_A.id, role: 'member', status: 'active' }
      ]
    })

    const res = await enroll({ classId: CLASS_A, code: CODE_A, user: MEMBER_A })

    expect(res.status).toBe(201)
    const gate = journal.indexOf('read:institution_memberships')
    const write = journal.indexOf('insert:enrollments')
    expect(gate).toBeGreaterThanOrEqual(0)
    expect(write).toBeGreaterThan(gate)
  })
})


// ---------------------------------------------------------------------------
// Preserved behaviour: authentication, validation, code match, conflict handling
// ---------------------------------------------------------------------------
describe('R26 R2 preserved enrollment behavior', () => {
  test('rejects an unauthenticated request with 401 before any lookup', async () => {
    const { journal } = arrange()

    const res = await enroll({ token: null, user: UNAFFILIATED })

    expect(res.status).toBe(401)
    expect(journal).toHaveLength(0)
  })

  test('rejects a non-POST method with 405', async () => {
    arrange()

    const res = await enroll({ method: 'GET' })

    expect(res.status).toBe(405)
  })

  test('rejects a missing or malformed class code with 400', async () => {
    arrange()

    const res = await enroll({ classId: CLASS_A, code: 'nope', user: MEMBER_A })

    expect(res.status).toBe(400)
    expect(res.payload.error).toBe('class code required to join')
  })

  test('returns 404 for an unknown class', async () => {
    arrange()

    const res = await enroll({ classId: 'missing-class', code: CODE_A, user: MEMBER_A })

    expect(res.status).toBe(404)
    expect(res.payload.error).toBe('Class not found')
  })

  test('returns 403 for a wrong code and does not query membership (no eligibility oracle)', async () => {
    const { journal } = arrange({
      institution_memberships: [
        { school_code: SCHOOL_A, user_id: MEMBER_A.id, role: 'member', status: 'active' }
      ]
    })

    const res = await enroll({ classId: CLASS_A, code: CODE_B, user: MEMBER_A })

    expect(res.status).toBe(403)
    expect(res.payload.error).toBe('Invalid class code')
    expect(eligibilityReads(journal)).toBe(0)
    expect(insertAttempts(journal)).toBe(0)
  })

  test('returns 500 when the class lookup itself fails', async () => {
    arrange({}, { errors: { classes: { message: 'db unavailable' } } })

    const res = await enroll({ classId: CLASS_A, code: CODE_A, user: MEMBER_A })

    expect(res.status).toBe(500)
    expect(res.payload.error).toBe('Unable to enroll in class')
  })

  test('normalizes a lowercase class code before comparison', async () => {
    arrange({
      institution_memberships: [
        { school_code: SCHOOL_A, user_id: MEMBER_A.id, role: 'member', status: 'active' }
      ]
    })

    const res = await enroll({ classId: CLASS_A, code: CODE_A.toLowerCase(), user: MEMBER_A })

    expect(res.status).toBe(201)
  })
})

