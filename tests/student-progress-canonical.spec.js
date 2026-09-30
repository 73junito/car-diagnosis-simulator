const fs = require('fs')
const path = require('path')
const { buildStudentProgress } = require('../api/_utils/student-progress')

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('canonical student progress', () => {
  test('aggregates only answers linked to the authenticated user attempts', () => {
    const attempts = [
      { id: 'a1', scenario: 'charging-system', created_at: '2026-09-01T10:00:00Z' },
      { id: 'a2', scenario: 'charging-system', created_at: '2026-09-02T10:00:00Z' },
      { id: 'a3', scenario: 'starting-system', created_at: '2026-09-03T10:00:00Z' }
    ]
    const answers = [
      { attempt_id: 'a1', is_correct: true, submitted_at: '2026-09-01T10:05:00Z' },
      { attempt_id: 'a1', is_correct: false, submitted_at: '2026-09-01T10:06:00Z' },
      { attempt_id: 'a2', is_correct: true, submitted_at: '2026-09-02T10:05:00Z' },
      { attempt_id: 'a3', is_correct: true, submitted_at: '2026-09-03T10:05:00Z' },
      { attempt_id: 'other-user-attempt', is_correct: true, submitted_at: '2026-09-04T10:05:00Z' }
    ]

    expect(buildStudentProgress(attempts, answers)).toEqual({
      performance: [
        {
          scenario_id: 'charging-system',
          responses: 3,
          correct_responses: 2,
          first_activity: '2026-09-01T10:05:00Z',
          last_activity: '2026-09-02T10:05:00Z',
          accuracy_pct: 66.67
        },
        {
          scenario_id: 'starting-system',
          responses: 1,
          correct_responses: 1,
          first_activity: '2026-09-03T10:05:00Z',
          last_activity: '2026-09-03T10:05:00Z',
          accuracy_pct: 100
        }
      ],
      transcript: {
        scenario_count: 2,
        response_count: 4,
        correct_response_count: 3,
        accuracy_pct: 75,
        last_activity: '2026-09-03T10:05:00Z'
      }
    })
  })

  test('returns an empty transcript when canonical answers do not exist', () => {
    expect(buildStudentProgress([], [])).toEqual({
      performance: [],
      transcript: null
    })
  })

  test('dashboard uses authenticated canonical progress API and no legacy summary views', () => {
    const dashboard = read('dashboard/student/student.js')

    expect(dashboard).toContain("fetch('/api/student/progress'")
    expect(dashboard).toContain('Authorization: `Bearer ${token}`')
    expect(dashboard).not.toContain('/rest/v1/student_performance_summary')
    expect(dashboard).not.toContain('/rest/v1/student_transcript_summary')
    expect(dashboard).not.toContain('avg_time_seconds')
    expect(dashboard).not.toContain('transcript.student_id')
  })

  test('server paths authenticate and scope both queries to verified user id', () => {
    for (const code of [
      read('api/student/progress.js'),
      read('worker/routes/student-progress.js')
    ]) {
      expect(code).toContain('extractBearerToken')
      expect(code).toContain('verifySupabaseToken')
      expect(code).toContain(".from('attempts')")
      expect(code).toContain(".from('attempt_answers')")
      expect(code.match(/\.eq\('user_id', user\.id\)/g)).toHaveLength(2)
      expect(code).not.toContain('question_attempts')
      expect(code).not.toContain('student_performance_summary')
      expect(code).not.toContain('student_transcript_summary')
    }
  })

  test('legacy view access migration is guarded and does not recreate legacy views', () => {
    const migration = read('supabase/migrations/20260930143909_restrict_legacy_student_summary_views.sql')

    expect(migration).toContain("to_regclass('public.student_performance_summary')")
    expect(migration).toContain("to_regclass('public.student_transcript_summary')")
    expect(migration).toContain('revoke all privileges on table public.student_performance_summary from anon, authenticated')
    expect(migration).toContain('revoke all privileges on table public.student_transcript_summary from anon, authenticated')
    expect(migration).not.toMatch(/create\s+(or\s+replace\s+)?view/i)
  })
})
