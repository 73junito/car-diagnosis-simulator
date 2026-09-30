import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260930005918_add_curriculum_reference_library.sql'),
  'utf8'
)
const route = fs.readFileSync(
  path.join(root, 'worker/routes/curriculum-references.js'),
  'utf8'
)
const workerIndex = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8')

describe('governed curriculum reference library', () => {
  test('creates service-role-only reference and mapping tables', () => {
    expect(migration).toContain('create table if not exists public.curriculum_reference_sources')
    expect(migration).toContain('create table if not exists public.curriculum_reference_mappings')
    expect(migration).toContain('alter table public.curriculum_reference_sources enable row level security')
    expect(migration).toContain('alter table public.curriculum_reference_mappings enable row level security')
    expect(migration).toContain('revoke all on public.curriculum_reference_sources from public, anon, authenticated')
    expect(migration).toContain('revoke all on public.curriculum_reference_mappings from public, anon, authenticated')
    expect(migration).toContain('grant select, insert, update, delete on public.curriculum_reference_sources to service_role')
  })

  test('approves the CC BY technical-writing reference for broad reuse', () => {
    expect(migration).toContain("'technical-writing-for-technicians-2019'")
    expect(migration).toContain("'CC_BY_4_0'")
    expect(migration).toContain("'https://openoregon.pressbooks.pub/ctetechwriting/'")
    expect(migration).toContain(
      "('technical-writing-for-technicians-2019', 'ug-aut180-service-information', 'technical-communication'"
    )
  })

  test('keeps OpenStax 2025-2026 noncommercial STEM sources reference-only', () => {
    for (const id of [
      'openstax-university-physics-v1-2026',
      'openstax-chemistry-2e-2026',
      'openstax-algebra-trigonometry-2e-2026',
      'openstax-principles-data-science-2025',
      'openstax-introduction-computer-science-2026',
      'openstax-additive-manufacturing-essentials-2025'
    ]) {
      expect(migration).toContain(`'${id}'`)
    }
    expect(migration).toContain("'CC_BY_NC_SA_4_0'")
    expect(migration).toContain(
      'production use is limited to bibliographic citation/linking unless additional commercial permission is obtained.'
    )
  })

  test('keeps Fiore AC circuit analysis noncommercial and reference-only', () => {
    expect(migration).toContain("'fiore-ac-electrical-circuit-analysis-2021'")
    expect(migration).toContain("'CC_NONCOMMERCIAL_SHAREALIKE_ATTRIBUTION'")
    expect(migration).toContain(
      "('fiore-ac-electrical-circuit-analysis-2021', 'ug-aut121-electrical-lab', 'electrical-theory-reference'"
    )
    expect(migration).toContain(
      "('fiore-ac-electrical-circuit-analysis-2021', 'ug-aut240-electrical-systems-ii', 'electrical-theory-reference'"
    )
  })

  test('stores SAE rights guidance internally with AI/database/direct reuse disabled', () => {
    expect(migration).toContain("'sae-reuse-guidance-2026'")
    expect(migration).toContain("'PUBLISHER_PERMISSION_REQUIRED'")
    expect(migration).toContain("'internal'")
    expect(migration).toContain(
      'AI/database storage requests require separate copyright-team evaluation.'
    )
  })

  test('exposes only active student references through a separate read-only endpoint', () => {
    expect(workerIndex).toContain(
      "app.get('/api/curriculum/references', handleCurriculumReferences)"
    )
    expect(route).toContain(".eq('status', 'active')")
    expect(route).toContain(".eq('audience', 'student')")
    expect(route).not.toContain('local_filename')
    expect(route).not.toContain('rights_basis')
    expect(route).toContain('aiRagIngestionAllowed')
    expect(route).toContain('commercialUseAllowed')
  })

  test('does not change the canonical curriculum response contract', () => {
    expect(workerIndex).toContain("app.all('/api/curriculum', handleCurriculumRead)")
    expect(workerIndex).toContain("app.get('/api/curriculum/references', handleCurriculumReferences)")
  })
})
