import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const migration = fs.readFileSync(
  path.join(
    root,
    'supabase/migrations/20261001025048_expand_reference_coverage_batch_4.sql'
  ),
  'utf8'
)

describe('curriculum reference coverage expansion batch 4', () => {
  test('adds exactly 13 governed mappings across 9 undergraduate lessons', () => {
    const mappingRows = [...migration.matchAll(/\(\n\s*'(?:technical-writing|openstax|nhtsa|bccampus)-/g)]
    expect(mappingRows).toHaveLength(13)

    const targets = [
      'ug-engine-performance-foundations',
      'ug-aut211-engine-performance-lab',
      'ug-aut250-automotive-diagnostics-i',
      'ug-aut251-diagnostics-lab',
      'ug-aut300-advanced-diagnostics',
      'ug-aut301-advanced-diagnostics-lab',
      'ug-aut321-hybrid-lab',
      'ug-aut331-electric-vehicle-lab',
      'ug-aut410-systems-integration'
    ]
    targets.forEach((lessonId) => expect(migration).toContain(lessonId))
  })

  test('leaves unsupported broad foundations and shop-safety lessons unmapped', () => {
    expect(migration).not.toContain("'ug-aut101-foundations'")
    expect(migration).not.toContain("'ug-aut105-safety-professional-practice'")
  })

  test('does not alter reference-source rights or assessment eligibility', () => {
    const forbidden = [
      'update public.curriculum_reference_sources',
      'ai_rag_ingestion_allowed =',
      'commercial_use_allowed =',
      'direct_reproduction_allowed =',
      'database_storage_allowed =',
      'license_classification =',
      'assessment_question_eligibility',
      'scored_assessment_eligible',
      'assessment_generation_allowed',
      'publication_status'
    ]
    forbidden.forEach((token) => expect(migration).not.toContain(token))
  })

  test('preserves explicit source-scope limitations', () => {
    expect(migration).toContain('not an automotive diagnostic authority')
    expect(migration).toContain('not an automotive architecture authority')
    expect(migration).toContain('no-AI/RAG controls remain unchanged')
    expect(migration).toContain('does not grant whole-page ingestion or assessment eligibility')
  })
})
