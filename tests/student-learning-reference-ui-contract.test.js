import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260930011726_map_chemistry_additive_manufacturing_references.sql'),
  'utf8'
)
const page = fs.readFileSync(
  path.join(root, 'dashboard/student/learning-path/index.html'),
  'utf8'
)

describe('student learning supplemental reference integration', () => {
  test('maps Chemistry 2e to HVAC and battery-system learning', () => {
    expect(migration).toContain(
      "'openstax-chemistry-2e-2026',\n  'ug-aut170-hvac-systems',\n  'chemistry-foundation'"
    )
    expect(migration).toContain(
      "'openstax-chemistry-2e-2026',\n  'ug-aut340-battery-management',\n  'electrochemistry-foundation'"
    )
    expect(migration).toContain(
      "'openstax-chemistry-2e-2026',\n  'grad-aut535-battery-systems',\n  'electrochemistry-foundation'"
    )
    expect(migration).toContain('The source remains noncommercial and is not ingested into AI/RAG.')
  })

  test('maps Additive Manufacturing Essentials to capstone planning and completion', () => {
    expect(migration).toContain(
      "'openstax-additive-manufacturing-essentials-2025',\n  'ug-aut450-capstone-i',\n  'design-prototyping-reference'"
    )
    expect(migration).toContain(
      "'openstax-additive-manufacturing-essentials-2025',\n  'ug-aut451-capstone-ii',\n  'design-prototyping-reference'"
    )
    expect(migration).toContain('The source remains noncommercial and is not ingested into AI/RAG.')
  })

  test('surfaces governed supplemental references on the student learning path', () => {
    expect(page).toContain('Supplemental STEM &amp; Technical References')
    expect(page).toContain("fetch('/api/curriculum/references'")
    expect(page).toContain("fetch('/api/curriculum'")
    expect(page).toContain('Mapped learning topics')
    expect(page).toContain('Open reference')
  })

  test('renders rights-aware labels and does not expose internal governance data', () => {
    expect(page).toContain('Reusable with attribution under the recorded license.')
    expect(page).toContain(
      'Reference only: citation/linking permitted; platform AI ingestion, direct reproduction, and commercial reuse are disabled.'
    )
    expect(page).not.toContain('rights_basis')
    expect(page).not.toContain('local_filename')
    expect(page).not.toContain('sae-reuse-guidance-2026')
  })

  test('uses vendor-neutral learning-path language', () => {
    expect(page).toContain('Track progress by vehicle system and diagnostic competency.')
  })
})
