const fs = require('fs')
const path = require('path')

describe('reference quality review batch 1', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009074500_add_reference_quality_review_batch_1.sql'
  )
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n')

  test('adds eight targeted mappings and no new source records', () => {
    const lessons = [
      'grad-aut520-data-analytics',
      'ug-aut131-engine-lab',
      'ug-aut211-engine-performance-lab',
      'ug-aut251-diagnostics-lab',
      'ug-aut301-advanced-diagnostics-lab',
      'ug-aut360-data-analysis',
      'ug-aut400-research-methods',
      'ug-aut410-systems-integration'
    ]
    lessons.forEach((id) => expect(migration).toContain(`'${id}'`))
    expect((migration.match(/\n\(/g) || []).length).toBeGreaterThanOrEqual(7)
    expect(migration).not.toContain('insert into public.curriculum_reference_sources')
  })

  test('reuses governed automotive sources appropriate to each review lesson', () => {
    [
      'automotive-engine-diagnostic-survey-2012',
      'doe-internal-combustion-engine-basics',
      'gm-pre-post-scan-position-2022',
      'sae-nissan-can-diagnostic-flow-2014',
      'nhtsa-cybersecurity-best-practices-modern-vehicles-2022'
    ].forEach((id) => expect(migration).toContain(`'${id}'`))
  })

  test('keeps the migration idempotent and assessment-neutral', () => {
    expect(migration).toContain('on conflict (reference_id, lesson_plan_id, role) do update set')
    expect(migration).not.toContain('assessment_eligible')
    expect(migration).not.toContain('approved_for_assessment')
  })

  test('documents why cross-domain lessons are not padded with weak automotive mappings', () => {
    expect(migration).toContain('Cross-domain lessons')
    expect(migration).toContain('direct-domain-authority')
  })
})
