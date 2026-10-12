const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'author-drafts.js'), 'utf8')
const authorHtml = fs.readFileSync(path.join(root, 'dashboard', 'author', 'index.html'), 'utf8')
const authorUi = fs.readFileSync(path.join(root, 'dashboard', 'author', 'author.js'), 'utf8')
const adminHtml = fs.readFileSync(path.join(root, 'dashboard', 'admin', 'index.html'), 'utf8')
const adminUi = fs.readFileSync(path.join(root, 'dashboard', 'admin', 'admin.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261012092021_add_authoring_review_lifecycle.sql'),
  'utf8'
)

describe('G7 authoring autosave and review lifecycle', () => {
  test('registers author review request and admin review routes', () => {
    expect(worker).toContain("app.post('/api/author/drafts/:draftId/review-request', handleAuthorDraftReviewRequest)")
    expect(worker).toContain("app.get('/api/admin/author-drafts/reviews', handleAdminAuthorDraftReviews)")
    expect(worker).toContain("app.patch('/api/admin/author-drafts/reviews/:draftId', handleAdminAuthorDraftReviewDecision)")
  })

  test('keeps review state separate from draft publication state', () => {
    expect(migration).toContain("review_status in ('not_requested', 'pending', 'changes_requested', 'review_complete')")
    expect(migration).toContain('Review completion does not publish content or grant training/assessment eligibility.')
    expect(route).toContain("review_status: 'pending'")
    expect(route).toContain("decision === 'review_complete'")
    expect(route).not.toContain("status: 'published'")
    expect(route).not.toContain("status: 'approved'")
    expect(route).not.toContain('assessment_question_eligibility')
  })

  test('locks edits during pending/completed review but permits requested changes', () => {
    expect(route).toContain(".in('review_status', ['not_requested', 'changes_requested'])")
    expect(route).toContain(".eq('review_status', 'not_requested')")
    expect(authorUi).toContain('draft.reviewStatus === "not_requested" || draft.reviewStatus === "changes_requested"')
    expect(authorUi).toContain('Review pending. Editing and autosave are locked')
    expect(authorUi).toContain('Review complete. This draft remains private and unpublished.')
  })

  test('records append-only lifecycle evidence through a private trigger helper', () => {
    expect(migration).toContain('create table if not exists public.scenario_authoring_draft_review_events')
    expect(migration).toContain('create or replace function private.capture_scenario_authoring_review_event()')
    expect(migration).toContain('security invoker')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('after update of review_status')
    expect(migration).toContain('from public, anon, authenticated, service_role')
    expect(migration).toContain('grant select, insert on table public.scenario_authoring_draft_review_events')
    expect(migration).not.toMatch(/grant\s+(update|delete).*scenario_authoring_draft_review_events/i)
  })

  test('autosaves only after a server draft exists', () => {
    expect(authorHtml).toContain('Autosave begins after the first explicit save.')
    expect(authorUi).toContain('if (!currentDraft || !reviewEditable(currentDraft)) return;')
    expect(authorUi).toContain('window.setTimeout(() =>')
    expect(authorUi).toContain('saveDraft({ autosave: true })')
    expect(authorUi).toContain('}, 1500);')
  })

  test('requires validation and latest saved version before requesting review', () => {
    expect(authorHtml).toContain('id="requestReviewBtn"')
    expect(authorUi).toContain('if (!validateScenario())')
    expect(authorUi).toContain('const saved = await saveDraft();')
    expect(authorUi).toContain('"/review-request"')
    expect(route).toContain(".eq('version', version)")
  })

  test('admin review UI exposes only changes-requested or review-complete decisions', () => {
    expect(adminHtml).toContain('Authoring draft review')
    expect(adminHtml).toContain('does not publish a scenario or grant learner or assessment eligibility')
    expect(adminUi).toContain("'review_complete'")
    expect(adminUi).toContain("'changes_requested'")
    expect(adminUi).not.toContain("'published'")
    expect(adminUi).not.toContain("decideAuthorDraft(draft, 'approved'")
    expect(adminUi).not.toContain("decideAuthorDraft(draft, 'published'")
    expect(adminUi).toContain('A review note is required when requesting changes.')
  })
})
