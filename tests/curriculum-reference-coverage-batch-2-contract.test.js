import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const migration = fs.readFileSync(
  path.join(
    root,
    'supabase/migrations/20260930022400_expand_reference_coverage_batch_2.sql'
  ),
  'utf8'
)

describe('curriculum reference coverage expansion batch 2', () => {
  test('adds exactly 15 governed lesson mappings', () => {
    const mappingRows = [...migration.matchAll(/\(\n\s*'(?:technical-writing|openstax|fiore)-/g)]
    expect(mappingRows).toHaveLength(15)
    expect(migration).toContain('insert into public.curriculum_reference_mappings')
    expect(migration).toContain(
      'on conflict (reference_id, lesson_plan_id, role) do update set'
    )
  })

  test('maps technical writing to four research and professional-documentation lessons', () => {
    const targets = [
      'grad-applied-research-literature',
      'grad-aut590-technology-seminar',
      'ug-aut400-research-methods',
      'ug-aut420-internship'
    ]
    targets.forEach((lessonId) => {
      expect(migration).toContain(
        `'technical-writing-for-technicians-2019',\n  '${lessonId}'`
      )
    })
  })

  test('maps data science to seven modeling, perception, testing, and evidence-analysis lessons', () => {
    const targets = [
      'grad-aut515-systems-modeling',
      'grad-aut560-adas-perception',
      'grad-aut565-autonomous-systems',
      'grad-aut585-digital-twins',
      'ug-aut350-adas',
      'grad-diagnostic-evidence-analysis',
      'grad-vehicle-systems-testing'
    ]
    targets.forEach((lessonId) => {
      expect(migration).toContain(
        `'openstax-principles-data-science-2025',\n  '${lessonId}'`
      )
    })
  })

  test('maps the governed electrical reference to three circuit/control lessons', () => {
    const targets = [
      'grad-aut540-power-electronics',
      'grad-aut580-control-systems',
      'ug-aut230-automotive-electronics'
    ]
    targets.forEach((lessonId) => {
      expect(migration).toContain(
        `'fiore-ac-electrical-circuit-analysis-2021',\n  '${lessonId}'`
      )
    })
  })

  test('maps Chemistry 2e to emissions and aftertreatment foundations', () => {
    expect(migration).toContain(
      "'openstax-chemistry-2e-2026',\n  'ug-aut270-emissions-systems',\n  'chemistry-foundation'"
    )
  })

  test('does not alter any reference-source rights', () => {
    expect(migration).not.toContain('update public.curriculum_reference_sources')
    expect(migration).not.toContain('ai_rag_ingestion_allowed =')
    expect(migration).not.toContain('commercial_use_allowed =')
    expect(migration).not.toContain('direct_reproduction_allowed =')
    expect(migration).not.toContain('database_storage_allowed =')
    expect(migration).not.toContain('license_classification =')
  })

  test('preserves reference-only notices for restricted sources', () => {
    expect(migration).toContain(
      'The source remains noncommercial and is not ingested into AI/RAG.'
    )
    expect(migration).toContain(
      'Noncommercial terms prohibit production content reuse.'
    )
  })

  test('does not create assessment or publication permissions', () => {
    expect(migration).not.toContain('scored_assessment_eligible')
    expect(migration).not.toContain('assessment_generation_allowed')
    expect(migration).not.toContain('publication_status')
  })
})
