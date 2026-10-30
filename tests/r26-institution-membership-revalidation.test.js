/** @jest-environment node */
/**
 * R26 Phase 2 / R1 — institution membership revalidation for owner routes.
 *
 * Scope: `GET /api/classes/:classId/students` (roster) and `POST /api/assign`.
 * Both use a service-role client, so RLS performs no check: class ownership must not be the last
 * word for a record that belongs to an institution, because the owner may have been suspended or
 * revoked since the class was created, or may own a class in an institution they never belonged to.
 *
 * T5 and T5b are the preserved negative controls from the Phase 2 baseline
 * (`tests/r26-phase2-authorization-matrix.evidence.js`, commit 9636273c), where a suspended
 * institution member read the roster with 200 and created an assignment with 201. Their
 * expectations are unchanged; they pass now because the routes changed.
 *
 * Unscoped classes are explicitly out of scope for this change: they keep ownership-only access
 * pending the F4 product decision, and the tests assert that deferral rather than conceal it.
 *
 * Not addressed here: direct PostgREST access still bypasses both routes. R26 remains PARTIAL.
 */

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))
jest.mock('../api/_utils/auth-utils.js', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseToken: jest.fn()
}))

const { createClient } = require('@supabase/supabase-js')
const { extractBearerToken, verifySupabaseToken } = require('../api/_utils/auth-utils.js')
const { handleClassRoster } = require('../worker/routes/classroom-classes.js')
const { handleCreateAssignment } = require('../worker/routes/classroom-assignments.js')

const SCHOOL_A = 'ZZA001'
const SCHOOL_B = 'ZZB002'
const CLASS_A = 'class-in-a'
const CLASS_FOREIGN = 'class-owned-in-b'
const CLASS_UNSCOPED = 'class-unscoped'
const STUDENT = 'student-in-a'

const INSTR_A = { id: 'instr-a', app_metadata: { role: 'instructor' } }
const INSTR_SUSPENDED = { id: 'instr-suspended', app_metadata: { role: 'instructor' } }
const INSTR_REVOKED = { id: 'instr-revoked', app_metadata: { role: 'instructor' } }
const INSTR_FOREIGN = { id: 'instr-foreign', app_metadata: { role: 'instructor' } }
const INSTR_UNSCOPED = { id: 'instr-unscoped', app_metadata: { role: 'instructor' } }
const STUDENT_ACTOR = { id: 'student-actor', app_metadata: { role: 'student' } }

let idCounter = 0

function makeWorld(overrides = {}) {
  return {
    institution_memberships: [
      { school_code: SCHOOL_A, user_id: INSTR_A.id, role: 'instructor', status: 'active' },
      { school_code: SCHOOL_A, user_id: INSTR_SUSPENDED.id, role: 'instructor', status: 'suspended' },
      { school_code: SCHOOL_A, user_id: INSTR_REVOKED.id, role: 'instructor', status: 'revoked' },
      // Owns a class in B while holding active membership only in A.
      { school_code: SCHOOL_A, user_id: INSTR_FOREIGN.id, role: 'instructor', status: 'active' }
    ],
    classes: [
      { id: CLASS_A, name: 'Class in A', owner_id: INSTR_A.id, class_code: 'AAA111', institution_school_code: SCHOOL_A },
      { id: 'class-of-suspended', name: 'Suspended owner class', owner_id: INSTR_SUSPENDED.id, class_code: 'SSS111', institution_school_code: SCHOOL_A },
      { id: 'class-of-revoked', name: 'Revoked owner class', owner_id: INSTR_REVOKED.id, class_code: 'RRR111', institution_school_code: SCHOOL_A },
      { id: CLASS_FOREIGN, name: 'Class in B', owner_id: INSTR_FOREIGN.id, class_code: 'BBB222', institution_school_code: SCHOOL_B },
      { id: CLASS_UNSCOPED, name: 'Independent class', owner_id: INSTR_UNSCOPED.id, class_code: 'UUU999', institution_school_code: null }
    ],
    enrollments: [
      { id: 'enr-1', class_id: CLASS_A, user_id: STUDENT, created_at: '2026-01-01' },
      { id: 'enr-2', class_id: 'class-of-suspended', user_id: STUDENT, created_at: '2026-01-02' },
      { id: 'enr-3', class_id: 'class-of-revoked', user_id: STUDENT, created_at: '2026-01-03' },
      { id: 'enr-4', class_id: CLASS_FOREIGN, user_id: STUDENT, created_at: '2026-01-04' },
      { id: 'enr-5', class_id: CLASS_UNSCOPED, user_id: STUDENT, created_at: '2026-01-05' }
    ],
    profiles: [{ id: STUDENT, email: 'student@example.invalid', role: 'student' }],
    assignments: [],
    ...overrides
  }
}

/**
 * Service-role-capable fake client. `journal` records `read:<table>` and `insert:<table>` events so
 * ordering can be asserted; `errors` injects a per-table error result.
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
            const result = errors[table] ? { data: null, error: errors[table] } : settle()
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

function makeContext({ method = 'GET', params = {}, body = null, token = 'valid-token' } = {}) {
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

function arrange(clientOptions = {}) {
  const world = makeWorld(clientOptions.world || {})
  const journal = []
  createClient.mockReturnValue(makeClient(world, journal, clientOptions.errors || {}))
  return { world, journal }
}

function readRoster({ classId = CLASS_A, user = INSTR_A, role = 'instructor', token = 'valid-token' } = {}) {
  if (token) session({ ...user, app_metadata: { role } })
  else extractBearerToken.mockReturnValue(null)
  return handleClassRoster(makeContext({ method: 'GET', params: { classId }, token }))
}

function createAssignment({
  classId = CLASS_A,
  user = INSTR_A,
  role = 'instructor',
  studentIds = [STUDENT],
  token = 'valid-token'
} = {}) {
  if (token) session({ ...user, app_metadata: { role } })
  else extractBearerToken.mockReturnValue(null)
  return handleCreateAssignment(
    makeContext({
      method: 'POST',
      body: { system: 'brakes', scenarioIds: ['scenario-1'], classId, studentIds },
      token
    })
  )
}

const events = (journal, prefix) => journal.filter((entry) => entry.startsWith(prefix))
const membershipReads = (journal) => events(journal, 'read:institution_memberships').length

beforeEach(() => {
  jest.clearAllMocks()
  idCounter = 0
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})


// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------
describe('R1 roster membership revalidation', () => {
  test('T5 a suspended institution member cannot read the roster of their own class', async () => {
    const { journal } = arrange()

    const res = await readRoster({ classId: 'class-of-suspended', user: INSTR_SUSPENDED })

    expect(res.status).toBe(403)
    expect(res.payload.error).toBe('Class access not permitted')
    expect(res.payload.students).toBeUndefined()
    expect(membershipReads(journal)).toBe(1)
    // The protected reads must not happen at all, not merely be discarded afterwards.
    expect(events(journal, 'read:enrollments')).toHaveLength(0)
    expect(events(journal, 'read:profiles')).toHaveLength(0)
  })

  test('T5h a revoked institution member cannot read the roster', async () => {
    const { journal } = arrange()

    const res = await readRoster({ classId: 'class-of-revoked', user: INSTR_REVOKED })

    expect(res.status).toBe(403)
    expect(events(journal, 'read:enrollments')).toHaveLength(0)
    expect(events(journal, 'read:profiles')).toHaveLength(0)
  })

  test('T5c [positive control] an active member of the class institution reads the roster', async () => {
    const { journal } = arrange()

    const res = await readRoster({ classId: CLASS_A, user: INSTR_A })

    expect(res.status).toBe(200)
    expect(res.payload.students).toEqual([
      { id: STUDENT, email: 'student@example.invalid', enrolled_at: '2026-01-01' }
    ])
    expect(membershipReads(journal)).toBe(1)
  })

  test('T5d an owner whose only membership is in another institution is refused', async () => {
    const { journal } = arrange()

    const res = await readRoster({ classId: CLASS_FOREIGN, user: INSTR_FOREIGN })

    expect(res.status).toBe(403)
    expect(res.payload.error).toBe('Class access not permitted')
    expect(events(journal, 'read:enrollments')).toHaveLength(0)
    expect(events(journal, 'read:profiles')).toHaveLength(0)
  })

  test('T5e a membership lookup failure returns 503 without any protected read', async () => {
    const { journal } = arrange({ errors: { institution_memberships: { message: 'timeout', code: '57014' } } })

    const res = await readRoster({ classId: CLASS_A, user: INSTR_A })

    expect(res.status).toBe(503)
    expect(res.payload.error).toBe('Unable to verify institution membership')
    expect(res.payload.students).toBeUndefined()
    expect(events(journal, 'read:enrollments')).toHaveLength(0)
    expect(events(journal, 'read:profiles')).toHaveLength(0)
  })

  test('T5f [preserved] an unscoped class keeps ownership-only roster access', async () => {
    const { journal } = arrange()

    const res = await readRoster({ classId: CLASS_UNSCOPED, user: INSTR_UNSCOPED })

    expect(res.status).toBe(200)
    expect(res.payload.students).toHaveLength(1)
    // No institution governs the class, so there is nothing to revalidate against.
    expect(membershipReads(journal)).toBe(0)
  })

  test('T5g authorization is resolved before enrollments and profile emails are read', async () => {
    const { journal } = arrange()

    await readRoster({ classId: CLASS_A, user: INSTR_A })

    const gate = journal.indexOf('read:institution_memberships')
    const enrollments = journal.indexOf('read:enrollments')
    const profiles = journal.indexOf('read:profiles')
    expect(gate).toBeGreaterThanOrEqual(0)
    expect(enrollments).toBeGreaterThan(gate)
    expect(profiles).toBeGreaterThan(enrollments)
  })

  test('T5i a non-owner still gets 404 and no membership query is issued', async () => {
    const { journal } = arrange()

    const res = await readRoster({ classId: CLASS_A, user: INSTR_FOREIGN })

    expect(res.status).toBe(404)
    expect(res.payload.error).toBe('Class not found')
    expect(membershipReads(journal)).toBe(0)
    expect(events(journal, 'read:enrollments')).toHaveLength(0)
  })
})


// ---------------------------------------------------------------------------
// Assignment creation
// ---------------------------------------------------------------------------
describe('R1 assignment membership revalidation', () => {
  test('T5b a suspended institution member cannot create an assignment for their own class', async () => {
    const { world, journal } = arrange()

    const res = await createAssignment({ classId: 'class-of-suspended', user: INSTR_SUSPENDED })

    expect(res.status).toBe(403)
    expect(res.payload.error).toBe('Class access not permitted')
    expect(res.payload.assignment).toBeUndefined()
    expect(membershipReads(journal)).toBe(1)
    expect(events(journal, 'read:enrollments')).toHaveLength(0)
    expect(events(journal, 'insert:assignments')).toHaveLength(0)
    expect(world.assignments).toHaveLength(0)
  })

  test('T5b-revoked a revoked institution member cannot create an assignment', async () => {
    const { world, journal } = arrange()

    const res = await createAssignment({ classId: 'class-of-revoked', user: INSTR_REVOKED })

    expect(res.status).toBe(403)
    expect(events(journal, 'insert:assignments')).toHaveLength(0)
    expect(world.assignments).toHaveLength(0)
  })

  test('T5c [positive control] an active member of the class institution creates an assignment', async () => {
    const { world, journal } = arrange()

    const res = await createAssignment({ classId: CLASS_A, user: INSTR_A })

    expect(res.status).toBe(201)
    expect(res.payload.success).toBe(true)
    expect(res.payload.assignment).toMatchObject({ class_id: CLASS_A, system: 'brakes' })
    expect(world.assignments).toHaveLength(1)
    expect(membershipReads(journal)).toBe(1)
  })

  test('T5d an owner whose only membership is in another institution cannot create an assignment', async () => {
    const { world, journal } = arrange()

    const res = await createAssignment({ classId: CLASS_FOREIGN, user: INSTR_FOREIGN })

    expect(res.status).toBe(403)
    expect(events(journal, 'read:enrollments')).toHaveLength(0)
    expect(events(journal, 'insert:assignments')).toHaveLength(0)
    expect(world.assignments).toHaveLength(0)
  })

  test('T5e a membership lookup failure returns 503 without validation reads or a write', async () => {
    const { world, journal } = arrange({ errors: { institution_memberships: { message: 'timeout', code: '57014' } } })

    const res = await createAssignment({ classId: CLASS_A, user: INSTR_A })

    expect(res.status).toBe(503)
    expect(res.payload.error).toBe('Unable to verify institution membership')
    expect(events(journal, 'read:enrollments')).toHaveLength(0)
    expect(events(journal, 'insert:assignments')).toHaveLength(0)
    expect(world.assignments).toHaveLength(0)
  })

  test('T5f [preserved] an unscoped class keeps ownership-only assignment creation', async () => {
    const { world, journal } = arrange()

    const res = await createAssignment({ classId: CLASS_UNSCOPED, user: INSTR_UNSCOPED })

    expect(res.status).toBe(201)
    expect(world.assignments).toHaveLength(1)
    expect(membershipReads(journal)).toBe(0)
  })

  test('T5g authorization is resolved before enrollment validation and before the insert', async () => {
    const { journal } = arrange()

    await createAssignment({ classId: CLASS_A, user: INSTR_A })

    const gate = journal.indexOf('read:institution_memberships')
    const enrollments = journal.indexOf('read:enrollments')
    const insert = journal.indexOf('insert:assignments')
    expect(gate).toBeGreaterThanOrEqual(0)
    expect(enrollments).toBeGreaterThan(gate)
    expect(insert).toBeGreaterThan(enrollments)
  })

  test('T5i a non-owner still gets 404 and no membership query is issued', async () => {
    const { world, journal } = arrange()

    const res = await createAssignment({ classId: CLASS_A, user: INSTR_FOREIGN })

    expect(res.status).toBe(404)
    expect(membershipReads(journal)).toBe(0)
    expect(world.assignments).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Preserved authentication and role controls on both routes
// ---------------------------------------------------------------------------
describe('R1 preserved authentication and role controls', () => {
  test('roster and assignment both reject unauthenticated callers with 401', async () => {
    const { journal } = arrange()

    const roster = await readRoster({ classId: CLASS_A, token: null })
    const assignment = await createAssignment({ classId: CLASS_A, token: null })

    expect(roster.status).toBe(401)
    expect(assignment.status).toBe(401)
    expect(membershipReads(journal)).toBe(0)
  })

  test('roster and assignment both reject a non-instructor role with 403', async () => {
    const { journal } = arrange()

    const roster = await readRoster({ classId: CLASS_A, user: STUDENT_ACTOR, role: 'student' })
    const assignment = await createAssignment({ classId: CLASS_A, user: STUDENT_ACTOR, role: 'student' })

    expect(roster.status).toBe(403)
    expect(assignment.status).toBe(403)
    expect(roster.payload.error).toBe('Instructor access required')
    expect(membershipReads(journal)).toBe(0)
  })

  test('assignment keeps its existing 400 validation for a missing system or scenario list', async () => {
    arrange()

    session({ ...INSTR_A, app_metadata: { role: 'instructor' } })
    const res = await handleCreateAssignment(
      makeContext({ method: 'POST', body: { classId: CLASS_A, scenarioIds: [] } })
    )

    expect(res.status).toBe(400)
  })
})

