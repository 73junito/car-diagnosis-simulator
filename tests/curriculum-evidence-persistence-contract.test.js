/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260929030656_curriculum_evidence_gap_persistence.sql'),
  'utf8'
)
const route = fs.readFileSync(path.join(root, 'worker/routes/curriculum-evidence.js'), 'utf8')
const workerIndex = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8')

describe('Curriculum evidence-gap persistence contract', () => {
  test('persists curriculum gaps and scholarly discovery records', () => {
    expect(migration).toContain('create table if not exists public.curriculum_module_gaps')
    expect(migration).toContain('create table if not exists public.curriculum_evidence_records')
    expect(migration).toContain('references public.curriculum_lesson_plans')
    expect(migration).toContain('references public.approved_sources')
    expect(migration).toContain('unique (gap_id, discovery_provider, provider_record_id)')
  })

  test('keeps both tables service-role only with RLS enabled', () => {
    expect(migration).toContain('alter table public.curriculum_module_gaps enable row level security')
    expect(migration).toContain('alter table public.curriculum_evidence_records enable row level security')
    expect(migration).toContain('revoke all on table public.curriculum_module_gaps from public, anon, authenticated')
    expect(migration).toContain('revoke all on table public.curriculum_evidence_records from public, anon, authenticated')
    expect(migration).toContain('grant select, insert, update, delete on table public.curriculum_module_gaps to service_role')
  })

  test('database cannot grant scored-assessment eligibility', () => {
    expect((migration.match(/scored_assessment_eligible boolean not null default false/g) || [])).toHaveLength(2)
    expect((migration.match(/check \(scored_assessment_eligible = false\)/g) || [])).toHaveLength(2)
    expect(route).toContain("scoredAssessmentEligibility: 'not-granted'")
  })

  test('approved evidence requires human review and verified reuse rights', () => {
    expect(migration).toContain('curriculum_evidence_records_approval_gate')
    expect(migration).toContain("license_status = 'verified-for-use'")
    expect(migration).toContain('reviewed_by is not null')
    expect(migration).toContain('license_reviewed_by is not null')
    expect(route).toContain('licenseReviewRequired: true')
  })

  test('gap relationships are derived server-side from the lesson plan', () => {
    expect(route).toContain(".from('curriculum_lesson_plans')")
    expect(route).toContain(".select('id, course_id, competency_id, academic_level')")
    expect(route).toContain('course_id: lesson.course_id')
    expect(route).toContain('competency_id: lesson.competency_id')
    expect(route).toContain('academic_level: lesson.academic_level')
  })

  test('routes reuse instructor research authorization and app-only CORS', () => {
    expect(route).toContain("import { authorizeResearch } from './semantic-scholar-research.js'")
    expect(route).toContain('authorizeResearch(c, { requireSemanticScholarEnabled: false })')
    expect(workerIndex).toContain("app.use('/api/research/curriculum-evidence/*'")
    expect(workerIndex).toContain("allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS']")
    expect(workerIndex).toContain("allowHeaders: ['Content-Type', 'Authorization']")
    expect(workerIndex).toContain("app.all('/api/research/curriculum-evidence/gaps'")
    expect(workerIndex).toContain("app.all('/api/research/curriculum-evidence/records'")
  })

  test('Semantic Scholar records are persisted as discovery, not approval', () => {
    expect(route).toContain("discovery_provider: 'semantic-scholar'")
    expect(migration).toContain("review_status text not null default 'discovered'")
    expect(migration).toContain("license_status text not null default 'unverified'")
  })
})
