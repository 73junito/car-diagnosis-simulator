import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260929230536_add_curriculum_enhancement_drafts.sql'),
  'utf8'
)
const indexMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260929232410_add_curriculum_enhancement_evidence_index.sql'),
  'utf8'
)
const route = fs.readFileSync(
  path.join(root, 'worker/routes/curriculum-enhancements.js'),
  'utf8'
)
const workerIndex = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8')
const html = fs.readFileSync(
  path.join(root, 'dashboard/instructor/research/index.html'),
  'utf8'
)
const ui = fs.readFileSync(
  path.join(root, 'dashboard/instructor/research/research.js'),
  'utf8'
)

describe('AI-assisted curriculum enhancement draft contract', () => {
  test('stores drafts separately and keeps them non-publishable and non-assessment', () => {
    expect(migration).toContain('create table if not exists public.curriculum_enhancement_drafts')
    expect(migration).toContain("status in ('draft','reviewed','rejected')")
    expect(migration).toContain("publication_status text not null default 'draft-only'")
    expect(migration).toContain("check (publication_status = 'draft-only')")
    expect(migration).toContain('scored_assessment_eligible boolean not null default false')
    expect(migration).toContain('check (scored_assessment_eligible = false)')
    expect(migration).toContain('assessment_generation_allowed boolean not null default false')
    expect(migration).toContain('check (assessment_generation_allowed = false)')
    expect(migration).not.toContain("'published'")
  })

  test('keeps draft tables service-role only with RLS enabled', () => {
    expect(migration).toContain('alter table public.curriculum_enhancement_drafts enable row level security')
    expect(migration).toContain('alter table public.curriculum_enhancement_draft_evidence enable row level security')
    expect(migration).toContain('revoke all on public.curriculum_enhancement_drafts from public, anon, authenticated')
    expect(migration).toContain('revoke all on public.curriculum_enhancement_draft_evidence from public, anon, authenticated')
    expect(migration).toContain('grant select, insert, update, delete on public.curriculum_enhancement_drafts to service_role')
    expect(indexMigration).toContain('idx_curriculum_enhancement_draft_evidence_evidence')
    expect(indexMigration).toContain('on public.curriculum_enhancement_draft_evidence(evidence_id)')
  })

  test('database evidence links fail closed unless approved evidence has explicit AI rights', () => {
    expect(migration).toContain('create or replace function public.enforce_curriculum_enhancement_evidence()')
    expect(migration).toContain("ev.review_status <> 'approved'")
    expect(migration).toContain("ev.license_status <> 'verified-for-use'")
    expect(migration).toContain('ev.scored_assessment_eligible is not false')
    expect(migration).toContain('scope.ai_rag_ingestion_allowed is not true')
    expect(migration).toContain('scope.citation_link_allowed is not true')
    expect(migration).toContain('scope.paraphrase_summary_allowed is not true')
    expect(migration).toContain('scope.database_storage_allowed is not true')
    expect(migration).toContain('draft_lesson_id <> evidence_lesson_id')
    expect(migration).toContain("source_status <> 'approved'")
    expect(migration).toContain("raise exception 'curriculum_enhancement_ai_rights_required'")
    expect(migration).toContain('create trigger curriculum_enhancement_evidence_gate')
  })

  test('worker exposes draft create/list and review/reject only', () => {
    expect(route).toContain("import { createClient } from '@supabase/supabase-js'")
    expect(workerIndex).toContain(
      "app.all('/api/research/curriculum-enhancements/drafts', handleCurriculumEnhancementDrafts)"
    )
    expect(workerIndex).toContain(
      "app.patch('/api/research/curriculum-enhancements/drafts/:draftId', handleCurriculumEnhancementDraftReview)"
    )
    expect(route).toContain("if (!['GET', 'POST'].includes(c.req.method))")
    expect(route).toContain("if (!['review', 'reject'].includes(action))")
    expect(route).not.toContain("action === 'publish'")
  })

  test('generation checks lesson ownership, evidence approval and explicit AI/RAG rights before provider access', () => {
    expect(route).toContain("gapLessonById.get(item.gap_id) !== lessonPlanId")
    expect(route).toContain("item.review_status !== 'approved'")
    expect(route).toContain("item.license_status !== 'verified-for-use'")
    expect(route).toContain('item.scored_assessment_eligible !== false')
    expect(route).toContain("sourceStatusById.get(sourceId) !== 'approved'")
    expect(route).toContain('scope.ai_rag_ingestion_allowed === true')
    expect(route).toContain('scope.citation_link_allowed === true')
    expect(route).toContain('scope.paraphrase_summary_allowed === true')
    expect(route).toContain('scope.database_storage_allowed === true')
    expect(route.indexOf('const blockedSource')).toBeLessThan(route.indexOf('requestOllama({'))
  })

  test('prompt explicitly prohibits assessment creation and publication', () => {
    expect(route).toContain('Do not create quiz questions, test items, answer keys, grading criteria, scores, or assessment content.')
    expect(route).toContain('Do not publish or claim approval.')
    expect(route).toContain('Paraphrase source content; do not reproduce long passages.')
    expect(route).toContain("assessmentGeneration: 'not-granted'")
    expect(route).toContain("publication: 'not-granted'")
  })

  test('instructor UI exposes selection, draft generation and review without publish controls', () => {
    expect(html).toContain('id="enhancement-goal"')
    expect(html).toContain('id="generate-enhancement-draft"')
    expect(html).toContain('id="enhancement-draft-list"')
    expect(ui).toContain('Use for AI-assisted curriculum enhancement draft')
    expect(ui).toContain('aiDraftRightsAllowed')
    expect(ui).toContain("apiRequest('/api/research/curriculum-enhancements/drafts'")
    expect(ui).toContain('Mark draft reviewed')
    expect(ui).toContain('Reject draft')
    expect(ui).not.toContain('Publish draft')
    expect(ui).not.toContain('scored_assessment_eligible: true')
  })
})
