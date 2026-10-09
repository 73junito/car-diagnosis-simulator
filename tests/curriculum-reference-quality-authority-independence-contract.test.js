const fs = require('fs')
const path = require('path')

describe('reference quality authority-independence refinement', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009082000_refine_reference_quality_authority_independence.sql'
  )
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n')

  test('adds only the final two independent-authority mappings', () => {
    expect(migration).toContain("'doe-vto-electric-drive-systems-rd'")
    expect(migration).toContain("'grad-aut501-integrated-systems'")
    expect(migration).toContain("'ies-continuous-improvement-education-toolkit-2020'")
    expect(migration).toContain("'grad-curriculum-assessment-design'")
    expect(migration).not.toContain('insert into public.curriculum_reference_sources')
  })

  test('keeps the mappings idempotent and assessment-neutral', () => {
    expect(migration).toContain('on conflict (reference_id, lesson_plan_id, role) do update set')
    expect(migration).not.toContain('assessment_eligible')
    expect(migration).not.toContain('approved_for_assessment')
  })
})
