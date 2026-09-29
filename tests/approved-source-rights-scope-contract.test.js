import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260929222509_add_approved_source_rights_scopes.sql'),
  'utf8'
)
const route = fs.readFileSync(
  path.join(root, 'worker/routes/curriculum-evidence.js'),
  'utf8'
)
const workerIndex = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8')
const ui = fs.readFileSync(
  path.join(root, 'dashboard/instructor/research/research.js'),
  'utf8'
)

describe('Approved source granular rights scope contract', () => {
  test('creates a service-role-only fail-closed rights table', () => {
    expect(migration).toContain('create table if not exists public.approved_source_rights_scopes')
    expect(migration).toContain('citation_link_allowed boolean not null default false')
    expect(migration).toContain('paraphrase_summary_allowed boolean not null default false')
    expect(migration).toContain('database_storage_allowed boolean not null default false')
    expect(migration).toContain('ai_rag_ingestion_allowed boolean not null default false')
    expect(migration).toContain('alter table public.approved_source_rights_scopes enable row level security')
    expect(migration).toContain('revoke all on public.approved_source_rights_scopes from public, anon, authenticated')
    expect(migration).toContain('grant select, insert, update, delete on public.approved_source_rights_scopes to service_role')
  })

  test('preserves the reviewed CC BY source without granting AI ingestion', () => {
    expect(migration).toContain("license->>'classification' = 'CC_BY'")
    expect(migration).toContain("license->>'reuse_permission_verified'")
    expect(migration).toContain('AI/RAG ingestion remains false pending separate explicit review')
  })

  test('enforces granular rights before database approval', () => {
    expect(migration).toContain('create or replace function public.enforce_curriculum_evidence_rights_scope()')
    expect(migration).toContain('scope.citation_link_allowed is not true')
    expect(migration).toContain('scope.paraphrase_summary_allowed is not true')
    expect(migration).toContain('scope.database_storage_allowed is not true')
    expect(migration).toContain("raise exception 'curriculum_evidence_rights_scope_required'")
    expect(migration).toContain('create trigger curriculum_evidence_rights_scope_gate')
  })

  test('exposes human-reviewed rights only through the authenticated worker', () => {
    expect(workerIndex).toContain(
      "app.patch('/api/research/curriculum-evidence/approved-sources/:sourceId/rights'"
    )
    expect(route).toContain('handleCurriculumApprovedSourceRightsReview')
    expect(route).toContain(".from('approved_source_rights_scopes')")
    expect(route).toContain("typeof body[key] !== 'boolean'")
    expect(route).toContain('license_evidence_reference is required')
    expect(route).toContain('reviewed_by: auth.user.id')
  })

  test('blocks curriculum approval unless current scoped rights are sufficient', () => {
    expect(route).toContain('rightsScope.citation_link_allowed === true')
    expect(route).toContain('rightsScope.paraphrase_summary_allowed === true')
    expect(route).toContain('rightsScope.database_storage_allowed === true')
    expect(route).toContain('rightsScope.expires_at >= today')
    expect(route).toContain('Current human-reviewed rights scope must allow citation/link')
  })

  test('lets reviewers explicitly record every permission in the instructor UI', () => {
    expect(ui).toContain('Citation / link')
    expect(ui).toContain('Paraphrase / summary')
    expect(ui).toContain('Direct excerpt / reprint')
    expect(ui).toContain('Figures / tables / diagrams')
    expect(ui).toContain('Database storage')
    expect(ui).toContain('AI / RAG ingestion')
    expect(ui).toContain('Commercial use')
    expect(ui).toContain('Save rights scope')
    expect(ui).toContain('/rights')
    expect(ui).not.toContain('scored_assessment_eligible: true')
  })
})
