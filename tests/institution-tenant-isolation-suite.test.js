const fs = require('fs')
const path = require('path')

const root = path.resolve('.')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const portal = read('worker/routes/institution-portal.js')
const membershipAdmin = read('worker/routes/institution-membership-admin.js')
const settingsDomains = read('worker/routes/institution-settings-domains.js')
const reporting = read('worker/routes/institution-reporting.js')
const classroom = read('worker/routes/classroom-classes.js')

const tenantFoundation = read(
  'supabase/migrations/20261012205000_add_institution_tenant_foundation.sql'
)
const membershipAdminMigration = read(
  'supabase/migrations/20261012210213_add_institution_membership_administration.sql'
)
const settingsDomainsMigration = read(
  'supabase/migrations/20261012212214_add_institution_settings_domains.sql'
)

describe('G8 institution tenant isolation security suite', () => {
  describe('portal and reporting reads', () => {
    test('portal authorization requires the caller active membership for the requested tenant', () => {
      expect(portal).toContain(".eq('school_code', schoolCode)")
      expect(portal).toContain(".eq('user_id', auth.user.id)")
      expect(portal).toContain(".eq('status', 'active')")
      expect(portal).toContain("if (!membership) return c.json({ error: 'Active institution membership required' }, 403)")
    })

    test('portal programs, cohorts, and classes are all scoped to the authorized tenant', () => {
      expect(portal).toContain(".from('institution_programs')")
      expect(portal).toContain(".from('institution_cohorts')")
      expect(portal).toContain(".eq('institution_school_code', schoolCode)")
      expect(portal).toContain(".eq('school_code', schoolCode)")
    })

    test('instructor portal class visibility is owner-scoped inside the tenant', () => {
      expect(portal).toContain("if (membership.role === 'instructor')")
      expect(portal).toContain("classQuery = classQuery.eq('owner_id', auth.user.id)")
    })

    test('institution reporting requires an active admin or owner membership', () => {
      expect(reporting).toContain("const REPORT_ROLES = new Set(['institution_admin', 'institution_owner'])")
      expect(reporting).toContain(".eq('school_code', schoolCode)")
      expect(reporting).toContain(".eq('user_id', auth.user.id)")
      expect(reporting).toContain(".eq('status', 'active')")
    })

    test('report population is derived only from tenant classes and their enrollments', () => {
      expect(reporting).toContain(".eq('institution_school_code', schoolCode)")
      expect(reporting).toContain(".from('enrollments')")
      expect(reporting).toContain(".in('class_id', batch)")
      expect(reporting).not.toContain('student_institution_claims')
      expect(reporting).not.toContain('institution_email_domains')
    })
  })

  describe('membership and invitation isolation', () => {
    test('admin target discovery is limited to the caller active admin tenants', () => {
      expect(membershipAdmin).toContain('async function loadAuthorizedAdminMemberships(auth)')
      expect(membershipAdmin).toContain(".eq('user_id', auth.user.id)")
      expect(membershipAdmin).toContain(".eq('status', 'active')")
      expect(membershipAdmin).toContain('ADMIN_ROLES.has(row.role)')
      expect(membershipAdmin).toContain("schoolCodes: memberships.map((row) => row.school_code)")
    })

    test('invitation revocation cannot observe or mutate a target outside authorized admin tenants', () => {
      expect(membershipAdmin).toContain(".in('school_code', authorized.schoolCodes)")
      expect(membershipAdmin).toContain(".eq('school_code', invitation.school_code)")
      expect(membershipAdmin).toContain("return c.json({ error: 'Institution invitation not found' }, 404)")
    })

    test('membership removal cannot observe or mutate a target outside authorized admin tenants', () => {
      expect(membershipAdmin).toContain(".in('school_code', authorized.schoolCodes)")
      expect(membershipAdmin).toContain(".eq('school_code', target.school_code)")
      expect(membershipAdmin).toContain("return c.json({ error: 'Institution membership not found' }, 404)")
    })

    test('recipient invitation discovery and acceptance are email-bound before target disclosure', () => {
      expect(membershipAdmin).toContain(".eq('email', userEmail)")
      expect(membershipAdmin).toContain('Confirmed account email required to accept institution invitation')
      expect(membershipAdmin).not.toContain('Invitation does not match the authenticated account email')
    })

    test('tenant admins cannot mutate administrator or owner roles', () => {
      expect(membershipAdmin).toContain("return targetRole === 'member' || targetRole === 'instructor'")
      expect(membershipAdmin).toContain('Only an institution owner may revoke administrator or owner invitations')
      expect(membershipAdmin).toContain('Only an institution owner may remove institution administrators or owners')
    })

    test('final active owner protection remains enforced in the database', () => {
      expect(membershipAdminMigration).toContain('create or replace function private.enforce_institution_owner_floor()')
      expect(membershipAdminMigration).toContain('cannot remove the final active institution owner')
    })
  })

  describe('settings and verified-domain isolation', () => {
    test('settings reads and writes require active admin membership in the requested tenant', () => {
      expect(settingsDomains).toContain('async function loadActiveAdminMembership(auth, schoolCode)')
      expect(settingsDomains).toContain(".eq('school_code', schoolCode)")
      expect(settingsDomains).toContain(".eq('user_id', auth.user.id)")
      expect(settingsDomains).toContain(".eq('status', 'active')")
      expect(settingsDomains).toContain("return c.json({ error: 'Institution administrator access required' }, 403)")
    })

    test('domain mutations are owner-only and tenant+domain scoped', () => {
      expect(settingsDomains).toContain("admin.membership.role !== 'institution_owner'")
      expect(settingsDomains).toContain(".eq('school_code', schoolCode)")
      expect(settingsDomains).toContain(".eq('domain', domain)")
      expect(settingsDomains).toContain('Institution owner access required for verified-domain changes')
    })

    test('verified domains cannot grant tenant membership or assessment authority', () => {
      expect(settingsDomainsMigration).toContain('A matching domain never creates institution membership')
      expect(settingsDomainsMigration).toContain('institution-admin role')
      expect(settingsDomainsMigration).toContain('assessment eligibility')
      expect(settingsDomains).not.toContain("from('assessment_question_eligibility')")
    })
  })

  describe('program, cohort, and class database isolation', () => {
    test('programs and cohorts carry tenant identity and same-tenant composite constraints', () => {
      expect(tenantFoundation).toContain('create table if not exists public.institution_programs')
      expect(tenantFoundation).toContain('create table if not exists public.institution_cohorts')
      expect(tenantFoundation).toMatch(/unique\s*\(id,\s*school_code\)/i)
      expect(tenantFoundation).toContain('foreign key (program_id, school_code)')
    })

    test('class tenant trigger requires active same-tenant instructor/admin/owner membership', () => {
      expect(tenantFoundation).toContain('create or replace function private.enforce_class_institution_scope()')
      expect(tenantFoundation).toContain("membership.status = 'active'")
      expect(tenantFoundation).toContain("membership.role in ('instructor', 'institution_admin', 'institution_owner')")
      expect(tenantFoundation).toContain('membership.school_code = new.institution_school_code')
    })

    test('class trigger rejects cross-tenant program and cohort references', () => {
      expect(tenantFoundation).toContain('institution_scope_rejected: program belongs to another institution')
      expect(tenantFoundation).toContain('institution_scope_rejected: cohort belongs to another institution')
      expect(tenantFoundation).toContain('institution_scope_rejected: cohort belongs to another program')
    })

    test('class creation resolves institution authority from active membership rather than identifiers alone', () => {
      expect(classroom).toContain(".from('institution_memberships')")
      expect(classroom).toContain(".eq('user_id', user.id)")
      expect(classroom).toContain(".eq('status', 'active')")
      expect(classroom).toContain("['instructor', 'institution_admin', 'institution_owner']")
    })
  })

  describe('direct database privilege boundary', () => {
    test('tenant administration tables remain service-role mediated rather than browser writable', () => {
      expect(tenantFoundation).toContain('alter table public.institution_memberships enable row level security')
      expect(tenantFoundation).toContain('alter table public.institution_programs enable row level security')
      expect(tenantFoundation).toContain('alter table public.institution_cohorts enable row level security')
      expect(tenantFoundation).toContain('revoke all on table public.institution_memberships')
      expect(tenantFoundation).toContain('revoke all on table public.institution_programs')
      expect(tenantFoundation).toContain('revoke all on table public.institution_cohorts')

      expect(membershipAdminMigration).toContain('alter table public.institution_membership_invitations enable row level security')
      expect(membershipAdminMigration).toContain('alter table public.institution_membership_events enable row level security')
      expect(membershipAdminMigration).toContain('revoke all on table public.institution_membership_invitations')
      expect(membershipAdminMigration).toContain('revoke all on table public.institution_membership_events')

      expect(settingsDomainsMigration).toContain('alter table public.institution_settings enable row level security')
      expect(settingsDomainsMigration).toContain('alter table public.institution_settings_events enable row level security')
      expect(settingsDomainsMigration).toContain('alter table public.institution_domain_events enable row level security')
      expect(settingsDomainsMigration).toContain('revoke all on table public.institution_settings')
      expect(settingsDomainsMigration).toContain('revoke all on table public.institution_settings_events')
      expect(settingsDomainsMigration).toContain('revoke all on table public.institution_domain_events')
    })

    test('tenant isolation never widens assessment eligibility', () => {
      expect(portal).not.toContain('assessment_question_eligibility')
      expect(membershipAdmin).not.toContain('assessment_question_eligibility')
      expect(settingsDomains).not.toContain("from('assessment_question_eligibility')")
      expect(reporting).not.toContain('assessment_question_eligibility')
      expect(classroom).not.toContain('assessment_question_eligibility')
    })
  })
})
