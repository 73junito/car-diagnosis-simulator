const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'institution-settings-domains.js'), 'utf8')
const instructorVerification = fs.readFileSync(path.join(root, 'worker', 'routes', 'instructor-verification.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'dashboard', 'institution', 'index.html'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'dashboard', 'institution', 'index.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261012212214_add_institution_settings_domains.sql'),
  'utf8'
)

describe('G8 institution settings and verified domains', () => {
  test('registers tenant-scoped settings and domain routes', () => {
    expect(worker).toContain("app.all('/api/institution/admin/settings', handleInstitutionAdminSettings)")
    expect(worker).toContain("app.all('/api/institution/admin/domains', handleInstitutionAdminDomains)")
    expect(worker).toContain("app.patch('/api/institution/admin/domains/:domain', handleInstitutionAdminDomainDecision)")
  })

  test('settings and audit tables are RLS enabled and service-role mediated', () => {
    expect(migration).toContain('create table if not exists public.institution_settings')
    expect(migration).toContain('create table if not exists public.institution_settings_events')
    expect(migration).toContain('create table if not exists public.institution_domain_events')
    expect(migration).toContain('alter table public.institution_settings enable row level security')
    expect(migration).toContain('alter table public.institution_settings_events enable row level security')
    expect(migration).toContain('alter table public.institution_domain_events enable row level security')
    expect(migration).toContain('grant select, insert, update on table public.institution_settings to service_role')
    expect(migration).toContain('grant select, insert on table public.institution_settings_events to service_role')
    expect(migration).toContain('grant select, insert on table public.institution_domain_events to service_role')
  })

  test('settings require active institution admin or owner membership', () => {
    expect(route).toContain(".from('institution_memberships')")
    expect(route).toContain(".eq('user_id', auth.user.id)")
    expect(route).toContain(".eq('status', 'active')")
    expect(route).toContain("const ADMIN_ROLES = new Set(['institution_admin', 'institution_owner'])")
    expect(route).toContain("return c.json({ error: 'Institution administrator access required' }, 403)")
  })

  test('verified-domain mutations require institution owner role', () => {
    expect(route).toContain("admin.membership.role !== 'institution_owner'")
    expect(route).toContain('Institution owner access required for verified-domain changes')
    expect(ui).toContain("activeActorRole === 'institution_owner'")
    expect(ui).toContain("domainAddButton.disabled = activeActorRole !== 'institution_owner'")
  })

  test('domain administration is soft-state and audited', () => {
    expect(migration).toContain('revoke delete on table public.institution_email_domains from service_role')
    expect(migration).toContain('create trigger capture_institution_domain_event')
    expect(migration).toContain("'added'")
    expect(migration).toContain("'reactivated'")
    expect(migration).toContain("'deactivated'")
    expect(migration).toContain("'source_updated'")
    expect(route).toContain('deactivated_by')
    expect(route).toContain('deactivated_at')
  })

  test('settings writes are audited with before/after state', () => {
    expect(migration).toContain('create trigger capture_institution_settings_event')
    expect(migration).toContain('before_json')
    expect(migration).toContain('after_json')
    expect(route).toContain('Institution settings saved and audit evidence recorded.')
  })

  test('domain evidence never directly grants tenant access or assessment eligibility', () => {
    expect(migration).toContain('A matching domain never creates institution membership')
    expect(route).not.toContain(".from('assessment_question_eligibility')")
    expect(route).not.toContain(".insert({\n      school_code: schoolCode,\n      user_id:")
    expect(instructorVerification).toContain('authorizationGranted: false')
    expect(instructorVerification).toContain("status: 'pending'")
    expect(instructorVerification).toContain('Instructor affiliation review is pending.')
  })

  test('portal exposes settings and verified-domain administration controls', () => {
    expect(html).toContain('id="institutionSettingsForm"')
    expect(html).toContain('Save Institution Settings')
    expect(html).toContain('id="institutionDomainForm"')
    expect(html).toContain('Add Verified Domain')
    expect(html).toContain('Verified domains are affiliation evidence only.')
    expect(ui).toContain("window.apiGet('/api/institution/admin/settings?schoolCode='")
    expect(ui).toContain("window.apiGet('/api/institution/admin/domains?schoolCode='")
    expect(ui).toContain("window.apiPatch('/api/institution/admin/settings'")
    expect(ui).toContain("window.apiPost('/api/institution/admin/domains'")
    expect(ui).toContain('Deactivate Domain')
    expect(ui).toContain('Reactivate Domain')
  })

  test('domain table comment explicitly rejects authorization inference', () => {
    expect(migration).toContain('affiliation evidence')
    expect(migration).toContain('never creates institution membership, instructor role, institution-admin role, or assessment eligibility')
  })
})
