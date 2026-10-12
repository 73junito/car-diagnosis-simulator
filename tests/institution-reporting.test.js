const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'institution-reporting.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'dashboard', 'institution', 'index.html'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'dashboard', 'institution', 'index.js'), 'utf8')

describe('G8 institution reporting', () => {
  test('registers the tenant-scoped institution report route', () => {
    expect(worker).toContain("app.get('/api/institution/admin/report', handleInstitutionAdminReport)")
  })

  test('requires active institution admin or owner membership', () => {
    expect(route).toContain("const REPORT_ROLES = new Set(['institution_admin', 'institution_owner'])")
    expect(route).toContain(".from('institution_memberships')")
    expect(route).toContain(".eq('user_id', auth.user.id)")
    expect(route).toContain(".eq('status', 'active')")
    expect(route).toContain('Institution administrator access required for institution reporting')
  })

  test('derives report population only from tenant-scoped classes and enrollments', () => {
    expect(route).toContain(".eq('institution_school_code', schoolCode)")
    expect(route).toContain(".from('enrollments')")
    expect(route).toContain(".in('class_id', batch)")
    expect(route).not.toContain('student_institution_claims')
    expect(route).not.toContain('institution_email_domains')
  })

  test('keeps reporting aggregate-only and excludes identity and answer-level data', () => {
    expect(route).not.toContain(".from('profiles')")
    expect(route).not.toContain('attempt_answers')
    expect(route).not.toContain('is_correct')
    expect(route).not.toContain('email')
    expect(route).toContain('uniqueStudents')
    expect(route).toContain('classSummaries')
  })

  test('does not alter assessment eligibility or imply transcript/credit status', () => {
    expect(route).not.toContain('assessment_question_eligibility')
    expect(route).toContain('Operational learning activity only.')
    expect(route).toContain('not a transcript, credential, academic-credit record, or institutional grade report')
    expect(html).toContain('not a transcript, credential, academic-credit record, or institutional grade report')
  })

  test('reports memberships, programs, cohorts, classes, enrollments, and attempt rollups', () => {
    expect(route).toContain('membershipCounts')
    expect(route).toContain('activeMemberships')
    expect(route).toContain('programs:')
    expect(route).toContain('cohorts:')
    expect(route).toContain('classes: classes.length')
    expect(route).toContain('enrollments: enrollments.length')
    expect(route).toContain('activity: summarizeAttempts(attempts)')
  })

  test('portal renders only aggregate report metrics and class rollups', () => {
    expect(html).toContain('id="institutionReportRefresh"')
    expect(html).toContain('id="institutionReportSummary"')
    expect(html).toContain('id="institutionClassReportList"')
    expect(ui).toContain("window.apiGet('/api/institution/admin/report?schoolCode='")
    expect(ui).toContain('Unique enrolled students')
    expect(ui).toContain('Completion rate')
    expect(ui).toContain('Average score')
    expect(ui).not.toContain('student.email')
  })
})
