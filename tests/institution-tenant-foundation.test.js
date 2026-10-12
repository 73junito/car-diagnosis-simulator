const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const portalRoute = fs.readFileSync(path.join(root, 'worker', 'routes', 'institution-portal.js'), 'utf8')
const classroomRoute = fs.readFileSync(path.join(root, 'worker', 'routes', 'classroom-classes.js'), 'utf8')
const portalHtml = fs.readFileSync(path.join(root, 'dashboard', 'institution', 'index.html'), 'utf8')
const portalUi = fs.readFileSync(path.join(root, 'dashboard', 'institution', 'index.js'), 'utf8')
const instructorHome = fs.readFileSync(path.join(root, 'dashboard', 'instructor', 'index.html'), 'utf8')
const build = fs.readFileSync(path.join(root, 'scripts', 'build-static-site.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261012205000_add_institution_tenant_foundation.sql'),
  'utf8'
)

describe('G8 institution tenant foundation', () => {
  test('creates membership, program, cohort, and class tenant scope', () => {
    expect(migration).toContain('create table if not exists public.institution_memberships')
    expect(migration).toContain('create table if not exists public.institution_programs')
    expect(migration).toContain('create table if not exists public.institution_cohorts')
    expect(migration).toContain('add column if not exists institution_school_code')
    expect(migration).toContain('institution_program_id')
    expect(migration).toContain('institution_cohort_id')
  })

  test('treats active membership as the authorization boundary', () => {
    expect(migration).toContain("status in ('invited', 'active', 'suspended')")
    expect(migration).toContain("role in ('member', 'instructor', 'institution_admin', 'institution_owner')")
    expect(migration).toContain('Directory records, domains, and school-code matches never grant institution access without an active membership row.')
    expect(portalRoute).toContain(".from('institution_memberships')")
    expect(portalRoute).toContain(".eq('user_id', auth.user.id)")
    expect(portalRoute).toContain(".eq('status', 'active')")
    expect(portalRoute).toContain("return c.json({ error: 'Active institution membership required' }, 403)")
  })

  test('approved instructor verification establishes instructor membership without granting admin role', () => {
    expect(migration).toContain('create or replace function private.sync_approved_instructor_membership()')
    expect(migration).toContain("new.status = 'approved'")
    expect(migration).toContain("'instructor'")
    expect(migration).not.toContain("new.status = 'approved' then 'institution_admin'")
  })

  test('database rejects cross-tenant class program and cohort links', () => {
    expect(migration).toContain('create or replace function private.enforce_class_institution_scope()')
    expect(migration).toContain("membership.role in ('instructor', 'institution_admin', 'institution_owner')")
    expect(migration).toContain('program belongs to another institution')
    expect(migration).toContain('cohort belongs to another institution')
    expect(migration).toContain('cohort belongs to another program')
  })

  test('new classes inherit verified institution membership instead of trusting a directory identifier', () => {
    expect(classroomRoute).toContain('resolveInstructorInstitution')
    expect(classroomRoute).toContain(".from('institution_memberships')")
    expect(classroomRoute).toContain(".in('role', ['instructor', 'institution_admin', 'institution_owner'])")
    expect(classroomRoute).toContain('institution_school_code: institution.schoolCode')
    expect(classroomRoute).toContain('Active instructor institution membership required')
  })

  test('portal APIs are bearer-authenticated and membership scoped', () => {
    expect(worker).toContain("app.get('/api/institution/memberships', handleInstitutionMemberships)")
    expect(worker).toContain("app.get('/api/institution/portal', handleInstitutionPortal)")
    expect(portalRoute).toContain('verifySupabaseToken')
    expect(portalRoute).toContain("membership.role === 'instructor'")
    expect(portalRoute).toContain(".eq('owner_id', auth.user.id)")
    expect(portalRoute).toContain("['institution_admin', 'institution_owner'].includes(membership.role)")
  })

  test('ships the read-only institution portal in the production static build', () => {
    expect(instructorHome).toContain('href="/dashboard/institution/"')
    expect(instructorHome).toContain('Institution Portal')
    expect(portalHtml).toContain('id="institutionSelect"')
    expect(portalHtml).toContain('School codes, domains, and directory matches alone do not grant tenant access.')
    expect(portalUi).toContain("window.apiGet('/api/institution/memberships')")
    expect(portalUi).toContain("'/api/institution/portal?schoolCode='")
    expect(build).toContain('"dashboard/institution/index.html"')
    expect(build).toContain('"dashboard/institution/index.js"')
  })

  test('tenant foundation does not grant assessment eligibility', () => {
    expect(migration).not.toContain('assessment_question_eligibility')
    expect(portalRoute).not.toContain('assessment_question_eligibility')
    expect(classroomRoute).not.toContain('assessment_question_eligibility')
  })
})
