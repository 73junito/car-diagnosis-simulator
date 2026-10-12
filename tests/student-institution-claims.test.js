const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'student-institution-claims.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261012223500_add_student_institution_claim_review.sql'),
  'utf8'
)
const studentHtml = fs.readFileSync(path.join(root, 'dashboard', 'student', 'index.html'), 'utf8')
const studentUi = fs.readFileSync(path.join(root, 'dashboard', 'student', 'institution-claim.js'), 'utf8')
const adminHtml = fs.readFileSync(path.join(root, 'dashboard', 'admin', 'index.html'), 'utf8')
const adminUi = fs.readFileSync(path.join(root, 'dashboard', 'admin', 'admin.js'), 'utf8')
const institutionHtml = fs.readFileSync(path.join(root, 'dashboard', 'institution', 'index.html'), 'utf8')
const institutionUi = fs.readFileSync(path.join(root, 'dashboard', 'institution', 'index.js'), 'utf8')

describe('G9 student institution claim review/status workflow', () => {
  test('registers student status and both reviewer route surfaces', () => {
    expect(worker).toContain("app.get('/api/student/institution-claim/status', handleStudentInstitutionClaimStatus)")
    expect(worker).toContain("app.get('/api/admin/student-institution-claims', handleStudentInstitutionClaimQueue)")
    expect(worker).toContain("app.patch('/api/admin/student-institution-claims/:userId', handleStudentInstitutionClaimDecision)")
    expect(worker).toContain("app.get('/api/institution/admin/student-claims', handleStudentInstitutionClaimQueue)")
    expect(worker).toContain("app.patch('/api/institution/admin/student-claims/:userId', handleStudentInstitutionClaimDecision)")
  })

  test('student status is scoped to authenticated user only', () => {
    expect(route).toContain(".from('student_institution_claims')")
    expect(route).toContain(".eq('user_id', auth.user.id)")
    expect(studentUi).toContain("fetch('/api/student/institution-claim/status'")
  })

  test('institution reviewers are active tenant admins or owners only', () => {
    expect(route).toContain("const REVIEW_ROLES = new Set(['institution_admin', 'institution_owner'])")
    expect(route).toContain(".eq('user_id', auth.user.id)")
    expect(route).toContain(".eq('status', 'active')")
    expect(route).toContain("query = query.in('school_code', scope.schoolCodes)")
    expect(route).toContain("lookup = lookup.in('school_code', scope.schoolCodes)")
  })

  test('platform admins may review globally through trusted role resolution', () => {
    expect(route).toContain('resolveTrustedRole')
    expect(route).toContain('isAdminRole')
    expect(route).toContain('if (isAdminRole(trustedRole)) return { platformAdmin: true, schoolCodes: null }')
  })

  test('decisions are terminal and rejection requires a note', () => {
    expect(route).toContain("if (current.status !== 'claimed')")
    expect(route).toContain('Student institution claim decision is already final')
    expect(route).toContain("if (decision === 'rejected' && !reviewNote)")
    expect(route).toContain(".eq('status', 'claimed')")
  })

  test('verified claims establish only a basic active member relationship', () => {
    expect(migration).toContain('create or replace function private.apply_verified_student_institution_claim()')
    expect(migration).toContain("old.status = 'claimed' and new.status = 'verified'")
    expect(migration).toContain("'member'")
    expect(migration).toContain("status = 'active'")
    expect(migration).toContain("when v_existing.role = 'institution_owner' then 'institution_owner'")
    expect(migration).toContain("when v_existing.role = 'institution_admin' then 'institution_admin'")
    expect(migration).toContain("when v_existing.role = 'instructor' then 'instructor'")
  })

  test('review decisions append immutable audit evidence', () => {
    expect(migration).toContain('create table if not exists public.student_institution_claim_events')
    expect(migration).toContain('alter table public.student_institution_claim_events enable row level security')
    expect(migration).toContain('grant select, insert on table public.student_institution_claim_events to service_role')
    expect(migration).toContain('create trigger capture_student_institution_claim_event')
    expect(migration).not.toMatch(/grant\s+(update|delete).*student_institution_claim_events/i)
  })

  test('claim verification cannot grant assessment eligibility or privileged institution roles', () => {
    expect(route).not.toContain('assessment_question_eligibility')
    expect(migration).not.toContain('assessment_question_eligibility')
    expect(route).not.toContain("role: 'institution_admin'")
    expect(route).not.toContain("role: 'institution_owner'")
    expect(route).not.toContain("role: 'instructor'")
  })

  test('student, platform-admin, and tenant-admin UIs expose truthful workflow states', () => {
    expect(studentHtml).toContain('id="studentInstitutionClaimStatus"')
    expect(studentUi).toContain('awaiting review')
    expect(adminHtml).toContain('Student institution claims')
    expect(adminUi).toContain('Verify Claim')
    expect(adminUi).toContain('Reject Claim')
    expect(institutionHtml).toContain('Student Institution Claims')
    expect(institutionUi).toContain('Verify Claim')
    expect(institutionUi).toContain('Reject Claim')
  })
})
