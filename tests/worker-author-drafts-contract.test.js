const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'author-drafts.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'dashboard', 'author', 'index.html'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'dashboard', 'author', 'author.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261012090441_add_scenario_authoring_drafts.sql'),
  'utf8'
)
const draftPersistenceRoute = route.slice(
  route.indexOf('export async function handleAuthorDrafts'),
  route.indexOf('function validEvidenceRole')
)

describe('G7 server-backed authoring draft contract', () => {
  test('registers authenticated draft routes on the production Worker', () => {
    expect(worker).toContain("app.use('/api/author/drafts', authorDraftCors)")
    expect(worker).toContain("app.use('/api/author/drafts/*', authorDraftCors)")
    expect(worker).toContain("app.all('/api/author/drafts', handleAuthorDrafts)")
    expect(worker).toContain("app.all('/api/author/drafts/:draftId', handleAuthorDraft)")
    expect(worker).toContain("allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']")
    expect(worker).toContain("allowHeaders: ['Content-Type', 'Authorization']")
  })

  test('author access is server verified and not a browser role gate', () => {
    expect(route).toContain('verifySupabaseToken')
    expect(route).toContain('resolveTrustedRole(user, supabase)')
    expect(route).toContain('isAdminRole(role)')
    expect(route).toContain('isInstructorRole(role)')
    expect(route).toContain(".from('instructor_verification_requests')")
    expect(route).toContain(".eq('status', 'approved')")
    expect(route).toContain(".from('institution_email_domains')")
    expect(ui).not.toContain('torquemindRole')
    expect(ui).not.toContain("localStorage.getItem('role')")
  })

  test('draft reads and writes are owner scoped with optimistic versioning', () => {
    expect(route).toContain(".eq('owner_id', auth.user.id)")
    expect(route).toContain(".eq('version', version)")
    expect(route).toContain('version: version + 1')
    expect(route).toContain("Draft changed since it was loaded; reload before saving")
    expect(route).toContain(".eq('status', 'draft')")
  })

  test('database table is RLS-enabled and service-role-only', () => {
    expect(migration).toContain('create table if not exists public.scenario_authoring_drafts')
    expect(migration).toContain('owner_id uuid not null references auth.users(id)')
    expect(migration).toContain('status = \'draft\'')
    expect(migration).toContain('alter table public.scenario_authoring_drafts enable row level security')
    expect(migration).toContain('from public, anon, authenticated, service_role')
    expect(migration).toContain('to service_role')
    expect(migration).not.toMatch(/create policy/i)
  })

  test('browser library uses the governed API and no localStorage persistence', () => {
    expect(html).toContain('<script src="/auth.js"></script>')
    expect(html).toContain('<script src="/apiClient.js"></script>')
    expect(ui).toContain('window.apiGet("/api/author/drafts?limit=100")')
    expect(ui).toContain('window.apiPost("/api/author/drafts", { scenario })')
    expect(ui).toContain('window.apiPatch("/api/author/drafts/"')
    expect(ui).toContain('window.apiDelete("/api/author/drafts/"')
    expect(ui).not.toContain('torquemind.scenarioLibrary')
    expect(ui).not.toContain('localStorage')
  })

  test('draft persistence has no publish or assessment eligibility side effect', () => {
    expect(migration).toContain('Draft persistence does not grant review, publication, training, scoring')
    expect(draftPersistenceRoute).not.toContain('assessment_question_eligibility')
    expect(draftPersistenceRoute).not.toContain('scenario_questions')
    expect(draftPersistenceRoute).not.toContain("publication_status: 'published'")
    expect(draftPersistenceRoute).not.toContain("status: 'approved'")
  })
})
