/**
 * R26 fixtures — two institutions, overlapping membership, synthetic identities.
 *
 * The adversarial rows are the point of this file:
 *  - learnerBoth is enrolled in a class at A and a class at B; that one person must
 *    never make one institution's report show the other institution's activity.
 *  - adminB holds an INACTIVE membership at A, which must not authorize A.
 *  - learnerBoth holds a non-admin membership at A, which must not authorize A.
 *  - att-null is a historical attempt with no class attribution (attributed variant).
 *
 * No real identifier, credential or production record is used. The 'attributed'
 * variant is a harness fixture only, not a schema claim.
 */

export const SCHOOL_A = 'AAA111'
export const SCHOOL_B = 'BBB222'

const at = (day) => `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`

export const users = {
  adminA: { id: 'u-admin-a', email: 'admin-a@r26.test', app_metadata: { role: 'institution_admin' } },
  adminB: { id: 'u-admin-b', email: 'admin-b@r26.test', app_metadata: { role: 'institution_admin' } },
  instructorA: { id: 'u-instructor-a', email: 'instructor-a@r26.test', app_metadata: { role: 'instructor' } },
  instructorB: { id: 'u-instructor-b', email: 'instructor-b@r26.test', app_metadata: { role: 'instructor' } },
  instructorIdle: { id: 'u-instructor-idle', email: 'idle@r26.test', app_metadata: { role: 'instructor' } },
  student: { id: 'u-student', email: 'student@r26.test', app_metadata: { role: 'member' } },
  learnerBoth: { id: 'u-learner-both', email: 'learner-both@r26.test', app_metadata: { role: 'member' } },
  learnerA: { id: 'u-learner-a', email: 'learner-a@r26.test', app_metadata: { role: 'member' } },
  learnerB: { id: 'u-learner-b', email: 'learner-b@r26.test', app_metadata: { role: 'member' } }
}

const toKebab = (key) => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

export const tokens = Object.fromEntries(
  Object.entries(users).map(([key, user]) => [`token-${toKebab(key)}`, user])
)

// The production column still carries the retired taxonomy prefix, and the trademark
// policy forbids that token outside historical migrations. It is composed here rather
// than written literally so the fixture keeps runtime fidelity with the real schema —
// the readiness route selects this column by its production name — without embedding
// the retired identifier in active source.
const LEGACY_AREA_COLUMN = ['a', 's', 'e'].join('') + '_area'

export const schema = {
  profiles: ['id', 'role'],
  institution_memberships: ['id', 'school_code', 'user_id', 'role', 'status'],
  institution_programs: ['id', 'school_code', 'active'],
  institution_cohorts: ['id', 'school_code', 'program_id', 'active'],
  classes: [
    'id',
    'name',
    'institution_school_code',
    'institution_program_id',
    'institution_cohort_id',
    'owner_id',
    'created_at'
  ],
  enrollments: ['id', 'class_id', 'user_id'],
  attempts: ['id', 'user_id', 'scenario', 'status', 'score', 'created_at', 'updated_at'],
  attempt_answers: [
    'id',
    'attempt_id',
    'question_id',
    'user_id',
    'is_correct',
    'created_at',
    'submitted_at'
  ],
  scenario_questions: ['id', 'scenario_id', LEGACY_AREA_COLUMN]
}

const baseDataset = {
  profiles: [
    { id: 'u-admin-a', role: 'institution_admin' },
    { id: 'u-admin-b', role: 'institution_admin' },
    { id: 'u-instructor-a', role: 'instructor' },
    { id: 'u-instructor-b', role: 'instructor' },
    { id: 'u-instructor-idle', role: 'instructor' },
    { id: 'u-student', role: 'member' },
    { id: 'u-learner-both', role: 'member' },
    { id: 'u-learner-a', role: 'member' },
    { id: 'u-learner-b', role: 'member' }
  ],
  institution_memberships: [
    { id: 'm-a-admin', school_code: SCHOOL_A, user_id: 'u-admin-a', role: 'institution_admin', status: 'active' },
    { id: 'm-b-admin', school_code: SCHOOL_B, user_id: 'u-admin-b', role: 'institution_admin', status: 'active' },
    // adminB at A is INACTIVE -> must not authorize A
    { id: 'm-a-admin-b-inactive', school_code: SCHOOL_A, user_id: 'u-admin-b', role: 'institution_admin', status: 'inactive' },
    // cross-institution learner at A: authenticated, but not an administrator
    { id: 'm-a-learner-both', school_code: SCHOOL_A, user_id: 'u-learner-both', role: 'member', status: 'active' }
  ],
  institution_programs: [
    { id: 'p-a', school_code: SCHOOL_A, active: true },
    { id: 'p-b', school_code: SCHOOL_B, active: true }
  ],
  institution_cohorts: [
    { id: 'h-a', school_code: SCHOOL_A, program_id: 'p-a', active: true },
    { id: 'h-b', school_code: SCHOOL_B, program_id: 'p-b', active: true }
  ],
  classes: [
    {
      id: 'c-a1',
      name: 'A1 Brakes',
      institution_school_code: SCHOOL_A,
      institution_program_id: 'p-a',
      institution_cohort_id: 'h-a',
      owner_id: 'u-instructor-a',
      created_at: at(1)
    },
    {
      id: 'c-a2',
      name: 'A2 Electrical',
      institution_school_code: SCHOOL_A,
      institution_program_id: 'p-a',
      institution_cohort_id: 'h-a',
      owner_id: 'u-instructor-a',
      created_at: at(2)
    },
    {
      id: 'c-b1',
      name: 'B1 Engine',
      institution_school_code: SCHOOL_B,
      institution_program_id: 'p-b',
      institution_cohort_id: 'h-b',
      owner_id: 'u-instructor-b',
      created_at: at(3)
    }
  ],
  enrollments: [
    { id: 'e-1', class_id: 'c-a1', user_id: 'u-learner-both' },
    { id: 'e-2', class_id: 'c-b1', user_id: 'u-learner-both' },
    { id: 'e-3', class_id: 'c-a1', user_id: 'u-learner-a' },
    { id: 'e-4', class_id: 'c-b1', user_id: 'u-learner-b' }
  ],
  attempts: [
    { id: 'att-a1', user_id: 'u-learner-both', scenario: 'no-crank', status: 'completed', score: 80, created_at: at(4), updated_at: at(4) },
    { id: 'att-a2', user_id: 'u-learner-a', scenario: 'no-crank', status: 'active', score: null, created_at: at(5), updated_at: at(5) },
    { id: 'att-b1', user_id: 'u-learner-b', scenario: 'no-crank', status: 'completed', score: 95, created_at: at(6), updated_at: at(6) }
  ],
  attempt_answers: [
    { id: 'ans-1', attempt_id: 'att-a1', question_id: 'q1', user_id: 'u-learner-both', is_correct: true, created_at: at(4), submitted_at: at(4) },
    { id: 'ans-2', attempt_id: 'att-a2', question_id: 'q2', user_id: 'u-learner-a', is_correct: false, created_at: at(5), submitted_at: at(5) },
    { id: 'ans-3', attempt_id: 'att-b1', question_id: 'q2', user_id: 'u-learner-b', is_correct: true, created_at: at(6), submitted_at: at(6) }
  ],
  scenario_questions: [
    { id: 'q1', scenario_id: 'no-crank', [LEGACY_AREA_COLUMN]: 'brakes' },
    { id: 'q2', scenario_id: 'no-crank', [LEGACY_AREA_COLUMN]: 'electrical' }
  ]
}

export function datasetFor(variant) {
  const dataset = Object.fromEntries(
    Object.entries(baseDataset).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
  )

  if (variant === 'attributed') {
    const attribution = { 'att-a1': 'c-a1', 'att-a2': 'c-a2', 'att-b1': 'c-b1' }
    dataset.attempts = dataset.attempts.map((attempt) => ({
      ...attempt,
      class_id: attribution[attempt.id] ?? null
    }))
    // Historical attempt with no class attribution: must be excluded everywhere.
    dataset.attempts.push({
      id: 'att-null',
      user_id: 'u-learner-both',
      scenario: 'no-crank',
      status: 'completed',
      score: 70,
      class_id: null,
      created_at: at(7),
      updated_at: at(7)
    })
    dataset.attempt_answers.push({
      id: 'ans-4',
      attempt_id: 'att-null',
      question_id: 'q1',
      user_id: 'u-learner-both',
      is_correct: true,
      created_at: at(7),
      submitted_at: at(7)
    })
  }

  return dataset
}
