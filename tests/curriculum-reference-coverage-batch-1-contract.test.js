import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const migration = fs.readFileSync(
  path.join(
    root,
    'supabase/migrations/20260930015304_expand_reference_coverage_batch_1.sql'
  ),
  'utf8'
).replace(/\r\n/g, '\n')

describe('curriculum reference coverage expansion batch 1', () => {
  test('adds exactly 17 governed lesson mappings', () => {
    const mappingRows = [...migration.matchAll(/\(\n\s*'openstax-/g)]
    expect(mappingRows).toHaveLength(17)
    expect(migration).toContain(
      'insert into public.curriculum_reference_mappings'
    )
    expect(migration).toContain(
      'on conflict (reference_id, lesson_plan_id, role) do update set'
    )
  })

  test('maps University Physics to nine defensible mechanics and energy lessons', () => {
    const targets = [
      'ug-aut130-engine-systems',
      'ug-aut160-drivetrain-systems',
      'ug-aut220-automatic-transmissions',
      'ug-aut260-vehicle-dynamics',
      'ug-brakes-foundations',
      'ug-suspension-steering-foundations',
      'ug-aut320-hybrid-vehicle-technology',
      'grad-aut530-advanced-ev-systems',
      'grad-aut545-energy-management'
    ]
    targets.forEach((lessonId) => {
      expect(migration).toContain(
        `'openstax-university-physics-v1-2026',\n  '${lessonId}'`
      )
    })
  })

  test('maps Introduction to Computer Science to eight computing-system lessons', () => {
    const targets = [
      'ug-aut310-network-communications',
      'ug-aut370-embedded-systems',
      'ug-aut380-cybersecurity',
      'ug-aut390-connected-sdv',
      'grad-aut550-automotive-networks',
      'grad-aut555-embedded-ecu',
      'grad-aut570-cybersecurity',
      'grad-aut575-software-defined-vehicle'
    ]
    targets.forEach((lessonId) => {
      expect(migration).toContain(
        `'openstax-introduction-computer-science-2026',\n  '${lessonId}'`
      )
    })
  })

  test('keeps both noncommercial sources reference-only', () => {
    expect(migration).toContain(
      'The source remains noncommercial and is not ingested into AI/RAG.'
    )
    expect(migration).not.toContain('update public.curriculum_reference_sources')
    expect(migration).not.toContain('ai_rag_ingestion_allowed = true')
    expect(migration).not.toContain('commercial_use_allowed = true')
    expect(migration).not.toContain('direct_reproduction_allowed = true')
    expect(migration).not.toContain('database_storage_allowed = true')
  })

  test('does not create assessment or publication permissions', () => {
    expect(migration).not.toContain('scored_assessment_eligible')
    expect(migration).not.toContain('assessment_generation_allowed')
    expect(migration).not.toContain('publication_status')
  })
})
