/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261011212851_admin_instructor_verification_review.sql'), 'utf8')
const worker = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker/routes/instructor-verification.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'dashboard/admin/index.html'), 'utf8')
const js = fs.readFileSync(path.join(root, 'dashboard/admin/admin.js'), 'utf8')

describe('admin instructor verification governance contract', () => {
  test('stores immutable append-only decision audit evidence behind RLS', () => {
    expect(migration).toContain('create table if not exists public.instructor_verification_decisions')
    expect(migration).toContain('alter table public.instructor_verification_decisions enable row level security')
    expect(migration).toContain('revoke all on table public.instructor_verification_decisions from public, anon, authenticated')
    expect(migration).toContain('grant select, insert on table public.instructor_verification_decisions to service_role')
    expect(migration).toContain('capture_instructor_verification_decision_trg')
    expect(migration).toContain('prevent_instructor_verification_decision_mutation_trg')
    expect(migration).toContain("raise exception 'Instructor verification decision audit rows are immutable'")
    expect(migration).toContain('security invoker')
  })

  test('registers admin-only list and decision routes on the production Worker', () => {
    expect(worker).toContain("app.get('/api/admin/instructor-verification/requests', handleAdminInstructorVerificationQueue)")
    expect(worker).toContain("app.patch('/api/admin/instructor-verification/requests/:requestId', handleAdminInstructorVerificationDecision)")
    expect(route).toContain('resolveTrustedRole(auth.user, auth.supabase)')
    expect(route).toContain('isAdminRole(role)')
    expect(route).toContain("c.json({ error: 'Admin access required' }, 403)")
    expect(route).toContain(".from('instructor_verification_decisions')")
    expect(route).toContain('Instructor verification review audit unavailable')
  })

  test('keeps affiliation approval separate from granting instructor privileges', () => {
    expect(route).not.toContain("update({ role:")
    expect(route).not.toContain(".from('profiles').update")
    expect(route).toContain('authorizationGranted: false')
    expect(route).toContain('A trusted instructor role is still required for privileged access.')
  })

  test('provides a token-authenticated admin review UI without direct database access', () => {
    expect(html).toContain('Instructor affiliation review')
    expect(html).toContain('/theme/layout.css')
    expect(html).toContain('noindex,nofollow')
    expect(html).toContain('/auth.js')
    expect(js).toContain('/api/admin/instructor-verification/requests?status=')
    expect(js).toContain("method: 'PATCH'")
    expect(js).toContain("Authorization: 'Bearer ' + accessToken")
    expect(js).not.toContain('createClient(')
    expect(js).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(js).toContain('window.confirm')
  })
})
