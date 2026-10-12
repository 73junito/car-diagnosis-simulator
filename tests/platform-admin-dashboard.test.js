const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'platform-admin-dashboard.js'), 'utf8')
const membershipAdmin = fs.readFileSync(path.join(root, 'worker', 'routes', 'institution-membership-admin.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261012224500_add_platform_admin_operational_settings.sql'),
  'utf8'
)
const html = fs.readFileSync(path.join(root, 'dashboard', 'admin', 'index.html'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'dashboard', 'admin', 'admin.js'), 'utf8')
const spec = fs.readFileSync(path.join(root, 'design-language', 'dashboards', 'administrator.md'), 'utf8')

describe('G10 platform administration dashboard', () => {
  test('registers platform-admin overview, user, institution, audit, and operational routes', () => {
    expect(worker).toContain("app.get('/api/admin/platform/overview', handlePlatformAdminOverview)")
    expect(worker).toContain("app.get('/api/admin/platform/users', handlePlatformAdminUsers)")
    expect(worker).toContain("app.get('/api/admin/platform/institutions', handlePlatformAdminInstitutions)")
    expect(worker).toContain("app.get('/api/admin/platform/audit', handlePlatformAdminAudit)")
    expect(worker).toContain("app.all('/api/admin/platform/operational-settings', handlePlatformAdminOperationalSettings)")
  })

  test('every platform dashboard API requires trusted platform admin authorization', () => {
    expect(route).toContain('async function authorizePlatformAdmin(c)')
    expect(route).toContain('resolveTrustedRole')
    expect(route).toContain('isAdminRole')
    expect(route).toContain("return { response: c.json({ error: 'Platform admin access required' }, 403) }")
  })

  test('user and trusted-role directory is visibility-only', () => {
    expect(route).toContain('auth.supabase.auth.admin.listUsers')
    expect(route).toContain('trustedRoleForUser')
    expect(route).toContain("source: 'app_metadata'")
    expect(route).toContain("source: 'profile'")
    expect(route).not.toContain('updateUserById')
    expect(route).not.toContain("auth.admin.update")
    expect(spec).toContain('read-only in G10')
  })

  test('institution inventory reports membership, owner/admin, and active-domain coverage', () => {
    expect(route).toContain(".from('institutions')")
    expect(route).toContain(".from('institution_memberships')")
    expect(route).toContain(".from('institution_email_domains')")
    expect(route).toContain('activeMemberships')
    expect(route).toContain('owners')
    expect(route).toContain('admins')
    expect(route).toContain('activeDomains')
  })

  test('unified audit feed reads existing append-only evidence sources', () => {
    for (const table of [
      'instructor_verification_decisions',
      'student_institution_claim_events',
      'institution_membership_events',
      'institution_domain_events',
      'institution_settings_events',
      'scenario_authoring_draft_review_events',
      'scenario_authoring_publication_events',
      'platform_operational_setting_events'
    ]) {
      expect(route).toContain(".from('" + table + "')")
    }
    expect(ui).toContain("api('/api/admin/platform/audit?limit=100')")
  })

  test('operational settings are service-role-only and append-only audited', () => {
    expect(migration).toContain('alter table public.platform_operational_settings enable row level security')
    expect(migration).toContain('alter table public.platform_operational_setting_events enable row level security')
    expect(migration).toContain('grant select, update on table public.platform_operational_settings to service_role')
    expect(migration).toContain('grant select, insert on table public.platform_operational_setting_events to service_role')
    expect(migration).not.toMatch(/grant\s+(update|delete).*platform_operational_setting_events/i)
    expect(migration).toContain('create trigger capture_platform_operational_setting_event')
  })

  test('owner bootstrap setting requires explicit confirmation and is server-enforced', () => {
    expect(route).toContain('Explicit confirmation is required to change owner bootstrap availability')
    expect(route).toContain('body?.confirmed !== true')
    expect(membershipAdmin).toContain(".from('platform_operational_settings')")
    expect(membershipAdmin).toContain('owner_bootstrap_enabled')
    expect(membershipAdmin).toContain('Institution owner bootstrap is temporarily disabled by platform operations')
    expect(ui).toContain('window.confirm')
    expect(ui).toContain('confirmed: changingHighRiskSetting')
  })

  test('dashboard exposes all required G10 modules and truthful governance language', () => {
    expect(html).toContain('Operations overview')
    expect(html).toContain('Users and trusted roles')
    expect(html).toContain('Institutions')
    expect(html).toContain('Instructor affiliation review')
    expect(html).toContain('Student institution claims')
    expect(html).toContain('Authoring draft review')
    expect(html).toContain('Authoring publication approval')
    expect(html).toContain('Unified audit history')
    expect(html).toContain('Operational configuration')
    expect(html).toContain('Role visibility is authoritative')
  })

  test('administrator interaction specification is non-empty and covers required states', () => {
    expect(spec.length).toBeGreaterThan(1500)
    expect(spec).toContain('## Authorization')
    expect(spec).toContain('## Information architecture')
    expect(spec).toContain('## Interaction rules')
    expect(spec).toContain('## Audit visibility')
    expect(spec).toContain('## Responsive behavior')
    expect(spec).toContain('## Security boundaries')
    expect(spec).toContain('## Operational states')
  })

  test('platform administration does not write assessment eligibility or expose grading secrets', () => {
    expect(route).not.toContain('assessment_question_eligibility')
    expect(migration).not.toContain('assessment_question_eligibility')
    expect(route).not.toContain('is_correct')
    expect(route).not.toContain('answer_key')
  })
})
