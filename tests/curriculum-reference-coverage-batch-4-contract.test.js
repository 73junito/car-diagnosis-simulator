import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const migration = fs.readFileSync(
  path.join(
    root,
    'supabase/migrations/20261001025048_expand_reference_coverage_batch_4.sql'
  ),
  'utf8'
).replace(/\r\n/g, '\n')

describe('curriculum reference coverage expansion batch 4', () => {
  test('adds exactly 13 governed mappings across 9 undergraduate lessons', () => {
    const mappingRows = [...migration.matchAll(/\(\n\s*'(?:technical-writing|openstax|nhtsa|bccampus)-/g)]
    expect(mappingRows).toHaveLength(13)

    const expectedMappings = [
      ['openstax-principles-data-science-2025', 'ug-engine-performance-foundations', 'diagnostic-data-foundation'],
      ['openstax-principles-data-science-2025', 'ug-aut211-engine-performance-lab', 'testing-data-foundation'],
      ['technical-writing-for-technicians-2019', 'ug-aut211-engine-performance-lab', 'laboratory-documentation'],
      ['openstax-principles-data-science-2025', 'ug-aut250-automotive-diagnostics-i', 'diagnostic-data-foundation'],
      ['openstax-principles-data-science-2025', 'ug-aut251-diagnostics-lab', 'testing-data-foundation'],
      ['technical-writing-for-technicians-2019', 'ug-aut251-diagnostics-lab', 'laboratory-documentation'],
      ['openstax-principles-data-science-2025', 'ug-aut300-advanced-diagnostics', 'diagnostic-data-foundation'],
      ['openstax-principles-data-science-2025', 'ug-aut301-advanced-diagnostics-lab', 'testing-data-foundation'],
      ['technical-writing-for-technicians-2019', 'ug-aut301-advanced-diagnostics-lab', 'laboratory-documentation'],
      ['nhtsa-electric-hybrid-vehicle-safety-2026', 'ug-aut321-hybrid-lab', 'high-voltage-safety-reference'],
      ['nhtsa-electric-hybrid-vehicle-safety-2026', 'ug-aut331-electric-vehicle-lab', 'high-voltage-safety-reference'],
      ['openstax-introduction-computer-science-2026', 'ug-aut410-systems-integration', 'computing-systems-foundation'],
      ['bccampus-basic-motor-control-2020', 'ug-aut410-systems-integration', 'control-systems-foundation']
    ]

    expectedMappings.forEach(([referenceId, lessonId, role]) => {
      expect(migration).toContain(
        `'${referenceId}',\n  '${lessonId}',\n  '${role}'`
      )
    })
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
