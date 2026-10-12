const fs = require('fs')
const path = require('path')
const {
  extractBrowserApiReferences,
  extractWorkerRoutes,
  matchesPattern,
  auditInventory
} = require('../scripts/verify-production-api-route-inventory.js')

const root = path.resolve('.')
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'config/production-api-route-inventory.json'), 'utf8'))

describe('production API route inventory', () => {
  test('all production browser API references are classified', () => {
    const audit = auditInventory()
    expect(audit.unclassified).toEqual([])
    expect(audit.staleKnown).toEqual([])
    expect(audit.registered.length).toBeGreaterThan(0)
    expect(audit.gaps.length).toBeGreaterThan(0)
  })

  test('canonical Worker routes include the governed assessment and research boundaries', () => {
    const routes = extractWorkerRoutes().map((entry) => entry.pattern)
    for (const expected of [
      '/api/scenario-questions-approved',
      '/api/scenario-submissions/grade',
      '/api/assessment-attempts/:attempt_id/questions',
      '/api/student/progress',
      '/api/curriculum',
      '/api/admin/instructor-verification/requests',
      '/api/research/curriculum-evidence/records',
      '/api/analytics/students',
      '/api/analytics/sessions',
      '/api/analytics/export'
    ]) expect(routes).toContain(expected)
  })

  test('known production gaps stay mapped to roadmap work', () => {
    const patterns = inventory.knownUnregisteredRoutes.map((entry) => entry.pattern)
    for (const expected of [
      '/api/telemetry/stream',
      '/api/attempts/save',
      '/api/approved-sources'
    ]) expect(patterns).toContain(expected)
    expect(patterns).not.toContain('/api/classes')
    expect(patterns).not.toContain('/api/classes/by-code/:param')
    expect(patterns).not.toContain('/api/classes/:param/enroll')
    for (const entry of inventory.knownUnregisteredRoutes) {
      expect(entry.gap).toMatch(/^G\d+$/)
      expect(entry.disposition.length).toBeGreaterThan(20)
    }
  })

  test('dynamic production references match canonical parameterized Worker routes', () => {
    expect(matchesPattern('/api/assessment-attempts/:param/questions', '/api/assessment-attempts/:attempt_id/questions')).toBe(true)
    expect(matchesPattern('/api/admin/instructor-verification/requests/:param', '/api/admin/instructor-verification/requests/:requestId')).toBe(true)
  })

  test('scanner includes browser assets that are actually copied by the production build', () => {
    const refs = extractBrowserApiReferences()
    expect(refs.has('/api/teacher/data')).toBe(false)
    expect(refs.get('/api/student/progress')).toContain('dashboard/student/student.js')
    expect(refs.get('/api/instructor/verification/status')).toContain('dashboard/instructor/index.js')
  })
  test('G5 analytics has no remaining known production gaps', () => {
    const g5 = inventory.knownUnregisteredRoutes.filter((entry) => entry.gap === 'G5')
    expect(g5).toEqual([])
    const refs = extractBrowserApiReferences()
    expect(refs.has('/api/analytics/summary')).toBe(false)
  })

  test('CTA analytics does not auto-fetch unscoped learner analytics', () => {
    const cta = fs.readFileSync(path.join(root, 'js', 'cta-analytics.js'), 'utf8')
    expect(cta).not.toContain('/api/analytics/summary')
    expect(cta).not.toContain('/api/analytics/sessions')
    expect(cta).not.toContain('/api/analytics/students')
    expect(cta).not.toContain('avgScore: 82')
    expect(cta).toContain('window.updateCTAAnalytics')
  })
})
