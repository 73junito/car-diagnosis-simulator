const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'author-drafts.js'), 'utf8')
const authorHtml = fs.readFileSync(path.join(root, 'dashboard', 'author', 'index.html'), 'utf8')
const authorUi = fs.readFileSync(path.join(root, 'dashboard', 'author', 'author.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261012094800_add_authoring_evidence_linkage.sql'),
  'utf8'
)

describe('G7 authoring evidence/source linkage', () => {
  test('registers approved evidence search and draft evidence routes', () => {
    expect(worker).toContain("app.get('/api/author/evidence-sources', handleAuthorEvidenceSources)")
    expect(worker).toContain("app.all('/api/author/drafts/:draftId/evidence', handleAuthorDraftEvidence)")
    expect(worker).toContain("app.delete('/api/author/drafts/:draftId/evidence/:linkId', handleAuthorDraftEvidenceLink)")
  })

  test('uses a private service-role-only linkage table', () => {
    expect(migration).toContain('create table if not exists public.scenario_authoring_draft_evidence')
    expect(migration).toContain('alter table public.scenario_authoring_draft_evidence enable row level security')
    expect(migration).toContain('from public, anon, authenticated, service_role')
    expect(migration).toContain('grant select, insert, delete on table public.scenario_authoring_draft_evidence')
    expect(migration).not.toMatch(/grant\s+update.*scenario_authoring_draft_evidence/i)
  })

  test('database rejects unapproved or cross-source evidence and locked review states', () => {
    expect(migration).toContain("v_chunk.source_id <> new.source_id")
    expect(migration).toContain("v_chunk.status <> 'approved'")
    expect(migration).toContain("v_source.status <> 'approved'")
    expect(migration).toContain("v_draft.review_status not in ('not_requested', 'changes_requested')")
  })

  test('worker search returns approved chunks only', () => {
    expect(route).toContain(".from('source_chunks')")
    expect(route).toContain(".eq('status', 'approved')")
    expect(route).toContain(".eq('approved', true)")
    expect(route).toContain(".from('approved_sources')")
  })

  test('author can link and unlink evidence only while the draft is editable', () => {
    expect(route).toContain("['not_requested', 'changes_requested'].includes(draft.review_status)")
    expect(route).toContain(".from('scenario_authoring_draft_evidence')")
    expect(route).toContain("message: 'Approved evidence linked to the private draft. This does not publish the scenario or grant assessment eligibility.'")
  })

  test('author UI exposes governed source search and linked evidence', () => {
    expect(authorHtml).toContain('id="evidence-sources"')
    expect(authorHtml).toContain('id="evidenceSearchInput"')
    expect(authorHtml).toContain('id="linkedEvidenceList"')
    expect(authorUi).toContain('searchApprovedEvidence')
    expect(authorUi).toContain('loadLinkedEvidence')
    expect(authorUi).toContain('Supports diagnosis')
  })

  test('evidence linkage does not add publication or assessment eligibility paths', () => {
    expect(route).not.toContain("status: 'published'")
    expect(route).not.toContain("status: 'approved'")
    expect(route).not.toContain('assessment_question_eligibility')
    expect(migration).toContain('does not publish or grant assessment eligibility')
  })
})
