const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'institution-membership-admin.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'dashboard', 'institution', 'index.html'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'dashboard', 'institution', 'index.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261012210213_add_institution_membership_administration.sql'),
  'utf8'
)

describe('G8 institution membership administration', () => {
  test('registers tenant-scoped membership administration routes', () => {
    expect(worker).toContain("app.get('/api/institution/admin/members', handleInstitutionAdminMembers)")
    expect(worker).toContain("app.all('/api/institution/admin/invitations', handleInstitutionAdminInvitations)")
    expect(worker).toContain("app.patch('/api/institution/admin/invitations/:invitationId', handleInstitutionAdminInvitationDecision)")
    expect(worker).toContain("app.get('/api/institution/invitations', handleInstitutionMyInvitations)")
    expect(worker).toContain("app.post('/api/institution/invitations/:invitationId/accept', handleInstitutionInvitationAccept)")
    expect(worker).toContain("app.patch('/api/institution/admin/members/:membershipId', handleInstitutionAdminMemberDecision)")
  })

  test('invitation tables are RLS enabled and service-role mediated', () => {
    expect(migration).toContain('create table if not exists public.institution_membership_invitations')
    expect(migration).toContain('create table if not exists public.institution_membership_events')
    expect(migration).toContain('alter table public.institution_membership_invitations enable row level security')
    expect(migration).toContain('alter table public.institution_membership_events enable row level security')
    expect(migration).toContain('revoke all on table public.institution_membership_invitations')
    expect(migration).toContain('grant select, insert, update on table public.institution_membership_invitations to service_role')
    expect(migration).toContain('grant select, insert on table public.institution_membership_events to service_role')
  })

  test('acceptance is email-bound, confirmed-email gated, and atomic with membership creation', () => {
    expect(route).toContain('Confirmed account email required to accept institution invitation')
    expect(route).toContain("invitation.email !== userEmail")
    expect(route).toContain(".eq('email', userEmail)")
    expect(migration).toContain('create or replace function private.accept_institution_invitation_membership()')
    expect(migration).toContain("new.status = 'accepted'")
    expect(migration).toContain("status = 'active'")
    expect(migration).toContain('create trigger accept_institution_invitation_membership')
  })

  test('tenant admins cannot manage administrator or owner roles', () => {
    expect(route).toContain("actorRole === 'institution_owner'")
    expect(route).toContain("return targetRole === 'member' || targetRole === 'instructor'")
    expect(route).toContain('Only an institution owner may invite institution administrators or owners')
    expect(route).toContain('Only an institution owner may remove institution administrators or owners')
  })

  test('membership removal is suspension-only and preserves the final active owner', () => {
    expect(migration).toContain('revoke delete on table public.institution_memberships from service_role')
    expect(route).toContain(".update({ status: 'suspended', updated_by: auth.user.id, updated_at: now })")
    expect(route).not.toContain(".delete().eq('id', target.id)")
    expect(migration).toContain('create or replace function private.enforce_institution_owner_floor()')
    expect(migration).toContain('cannot remove the final active institution owner')
  })

  test('membership lifecycle writes append-only audit evidence transactionally', () => {
    expect(migration).toContain('create trigger capture_institution_invitation_event')
    expect(migration).toContain('create trigger capture_institution_membership_status_event')
    expect(migration).toContain("'membership_suspended'")
    expect(migration).toContain("'membership_reactivated'")
    expect(migration).not.toMatch(/grant\s+(update|delete).*institution_membership_events/i)
  })

  test('portal UI supports invitations, acceptance, revocation, and membership removal', () => {
    expect(html).toContain('id="myInvitationList"')
    expect(html).toContain('id="institutionAdminPanel"')
    expect(html).toContain('id="institutionInviteForm"')
    expect(html).toContain('id="institutionMemberList"')
    expect(ui).toContain("window.apiGet('/api/institution/invitations')")
    expect(ui).toContain('Accept Invitation')
    expect(ui).toContain('Create Invitation')
    expect(ui).toContain('Revoke Invitation')
    expect(ui).toContain('Remove Membership')
  })

  test('membership administration remains separate from student claims and assessment eligibility', () => {
    expect(route).not.toContain('student_institution_claims')
    expect(route).not.toContain('assessment_question_eligibility')
    expect(migration).not.toContain('student_institution_claims')
    expect(migration).not.toContain('assessment_question_eligibility')
  })
})
