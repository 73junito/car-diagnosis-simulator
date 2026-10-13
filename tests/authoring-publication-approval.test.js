const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'author-drafts.js'), 'utf8')
const authorHtml = fs.readFileSync(path.join(root, 'dashboard', 'author', 'index.html'), 'utf8')
const authorUi = fs.readFileSync(path.join(root, 'dashboard', 'author', 'author.js'), 'utf8')
const adminHtml = fs.readFileSync(path.join(root, 'dashboard', 'admin', 'index.html'), 'utf8')
const adminUi = fs.readFileSync(path.join(root, 'dashboard', 'admin', 'admin.js'), 'utf8')
const roadmap = fs.readFileSync(path.join(root, 'docs', 'phase-4-functional-gap-roadmap.md'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261012195501_add_authoring_publication_approval.sql'),
  'utf8'
)

describe('G7 explicit publication approval', () => {
  test('registers author request and admin publication routes', () => {
    expect(worker).toContain("app.post('/api/author/drafts/:draftId/publication-request', handleAuthorDraftPublicationRequest)")
    expect(worker).toContain("app.get('/api/admin/author-drafts/publications', handleAdminAuthorDraftPublications)")
    expect(worker).toContain("app.patch('/api/admin/author-drafts/publications/:draftId', handleAdminAuthorDraftPublicationDecision)")
  })

  test('publication state is explicit, audited, and service-role mediated', () => {
    expect(migration).toContain("publication_status in ('unpublished', 'pending', 'changes_requested', 'published')")
    expect(migration).toContain('create table if not exists public.scenario_authoring_publication_events')
    expect(migration).toContain('alter table public.scenario_authoring_publication_events enable row level security')
    expect(migration).toContain('grant select, insert on table public.scenario_authoring_publication_events')
  })

  test('database requires completed review and governed evidence before publication request', () => {
    expect(migration).toContain("new.review_status <> 'review_complete'")
    expect(migration).toContain('from public.scenario_authoring_draft_evidence')
    expect(migration).toContain('at least one governed evidence link is required')
    expect(migration).toContain("old.publication_status = 'published'")
  })

  test('author publication request uses optimistic versioning and explicit gates', () => {
    expect(route).toContain('handleAuthorDraftPublicationRequest')
    expect(route).toContain(".eq('review_status', 'review_complete')")
    expect(route).toContain(".eq('publication_status', 'unpublished')")
    expect(route).toContain(".select('id', { count: 'exact', head: true })")
    expect(route).toContain('Publication approval requested. This does not grant learner delivery, scoring, or assessment eligibility.')
  })

  test('publication changes reopen review before another request', () => {
    expect(route).toContain("publication_status: 'changes_requested'")
    expect(route).toContain("review_status: 'changes_requested'")
    expect(route).toContain('Draft review is reopened before another publication request.')
  })

  test('author and admin UIs expose the governed publication workflow', () => {
    expect(authorHtml).toContain('id="requestPublicationBtn"')
    expect(authorUi).toContain('requestPublication')
    expect(authorUi).toContain('Publication Approval Requested')
    expect(adminHtml).toContain('id="author-publication-queue"')
    expect(adminUi).toContain('Approve Publication')
    expect(adminUi).toContain('Request Publication Changes')
  })

  test('publication remains separate from assessment eligibility', () => {
    expect(route).not.toContain(".from('assessment_question_eligibility')")
    expect(migration).not.toContain('assessment_question_eligibility')
    expect(migration).toContain('Publication never grants learner delivery, scoring, or assessment eligibility.')
    expect(roadmap).toContain('**Gap:** closed.')
    expect(roadmap).toContain('[x] Explicit publication workflow separate from assessment eligibility.')
  })
})
