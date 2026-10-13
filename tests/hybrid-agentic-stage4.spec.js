const fs = require('fs')
const path = require('path')
const {
  StudentCoachAgent,
  InstructorIntelligenceAgent,
  EngineeringMaintenanceAgent
} = require('../src/ai')

const root = path.resolve('.')
const studentRoute = fs.readFileSync(path.join(root,'worker/routes/student-recommendations.js'),'utf8')
const instructorRoute = fs.readFileSync(path.join(root,'worker/routes/instructor-analytics.js'),'utf8')
const worker = fs.readFileSync(path.join(root,'worker/index.js'),'utf8')
const coachUi = fs.readFileSync(path.join(root,'dashboard/student/coach/coach.js'),'utf8')
const catalog = JSON.parse(fs.readFileSync(path.join(root,'data/architecture/agent-orchestration-foundation.json'),'utf8'))

describe('Hybrid agentic roadmap Stage 4', () => {
  test('student coach summary remains preparation-only and training-only', () => {
    const result = StudentCoachAgent.prepareStudentCoachSummary({
      state: 'available',
      recommendations: [
        { scenario_id: 'starting-system', reason: 'Practice history', action: 'practice' }
      ]
    })

    expect(result.status).toBe('available')
    expect(result.priorities).toHaveLength(1)
    expect(result.boundary).toMatchObject({
      preparationOnly: true,
      assessmentDataUsed: false,
      mayGrade: false,
      mayChangeEligibility: false,
      mayRelease: false
    })
    expect(studentRoute).toContain("const PRACTICE_MODE = 'training'")
    expect(studentRoute).toContain('prepareStudentCoachSummary')
    expect(studentRoute).not.toContain("delivery_mode', 'assessment'")
  })

  test('student coach UI exposes summary without converting it into a grade', () => {
    expect(coachUi).toContain('payload.coachSummary?.summary')
    expect(coachUi).toContain('Recommendations remain practice-only and are not grades or assessment decisions.')
  })

  test('instructor intelligence excludes learner identity from prepared output', () => {
    const result = InstructorIntelligenceAgent.prepareInstructorIntelligence({
      classId: 'class-1',
      totalStudents: 2,
      students: [
        { id: 'user-1', name: 'student@example.com', sessions: 4, completedSessions: 1, averageScore: 62, answerAccuracy: 58 },
        { id: 'user-2', name: 'other@example.com', sessions: 4, completedSessions: 4, averageScore: 92, answerAccuracy: 95 }
      ],
      sessions: { totalSessions: 8, completedSessions: 5, completionRate: 62.5, averageScore: 77 }
    })

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('student@example.com')
    expect(serialized).not.toContain('other@example.com')
    expect(serialized).not.toContain('user-1')
    expect(result.boundary).toMatchObject({
      preparationOnly: true,
      readOnly: true,
      learnerIdentityExcluded: true,
      mayGrade: false,
      mayChangeEligibility: false,
      mayRelease: false
    })
    expect(result.signals.join(' ')).toMatch(/low completion|below 70%/)
  })

  test('instructor intelligence route preserves instructor auth and class ownership scope', () => {
    expect(instructorRoute).toContain('const auth = await authorizeInstructor(c)')
    expect(instructorRoute).toContain('await loadOwnedClassPopulation(auth, classId)')
    expect(instructorRoute).toContain(".eq('owner_id', auth.user.id)")
    expect(instructorRoute).toContain('prepareInstructorIntelligence')
    expect(worker).toContain("app.get('/api/analytics/intelligence', handleInstructorIntelligence)")
  })

  test('engineering maintenance agent prepares plans but cannot commit merge deploy or release', async () => {
    const plan = EngineeringMaintenanceAgent.prepareMaintenancePlan({
      scope: 'ci',
      objective: 'Review failing workflow contracts',
      files: ['.github/workflows/ci.yml'],
      checks: ['npm test']
    })

    expect(plan.boundary).toEqual({
      preparationOnly: true,
      mayCommit: false,
      mayMerge: false,
      mayDeploy: false,
      mayRelease: false,
      requiresHumanExecutionApproval: true
    })

    expect(() => EngineeringMaintenanceAgent.prepareMaintenancePlan({
      scope: 'production-deploy',
      objective: 'Deploy directly'
    })).toThrow(/Unsupported maintenance scope/)
  })

  test('all stage4 agents are governance-catalog preparation-only agents', () => {
    for (const id of [
      'student-coach-agent',
      'instructor-intelligence-agent',
      'engineering-maintenance-agent'
    ]) {
      const agent = catalog.agents.find((item) => item.id === id)
      expect(agent).toBeDefined()
      expect(agent.may_prepare).toBe(true)
      expect(agent.may_human_approve).toBe(false)
      expect(agent.may_release).toBe(false)
    }
  })

  test('stage4 agents execute only their declared capability', async () => {
    const coach = StudentCoachAgent.createStudentCoachAgent()
    const instructor = InstructorIntelligenceAgent.createInstructorIntelligenceAgent()
    const maintenance = EngineeringMaintenanceAgent.createEngineeringMaintenanceAgent()

    await expect(coach.execute({
      input: { recommendations: [] },
      process: { capability: 'student-practice-summary-preparation' }
    })).resolves.toMatchObject({ status: 'insufficient-history' })

    await expect(instructor.execute({
      input: { students: [] },
      process: { capability: 'instructor-training-summary-preparation' }
    })).resolves.toHaveProperty('boundary.readOnly', true)

    await expect(maintenance.execute({
      input: { scope: 'tests', objective: 'Prepare test maintenance plan' },
      process: { capability: 'engineering-maintenance-plan-preparation' }
    })).resolves.toHaveProperty('boundary.mayMerge', false)
  })
})
