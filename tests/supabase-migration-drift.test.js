const fs = require('fs')
const path = require('path')
const {
  parseMigrationPath,
  compareMigrationHistories,
  projectRefFromUrl
} = require('../scripts/verify-supabase-migration-drift.js')

describe('Supabase migration drift detector', () => {
  test('parses canonical migration filenames', () => {
    expect(parseMigrationPath('supabase/migrations/20261011220034_expose_migration_history_for_drift_check.sql')).toEqual({
      version: '20261011220034',
      name: 'expose_migration_history_for_drift_check',
      file: 'supabase/migrations/20261011220034_expose_migration_history_for_drift_check.sql'
    })
  })

  test('accepts timestamp-renamed logical equivalents', () => {
    const result = compareMigrationHistories(
      [{ version: '20260924180000', name: 'repair_question_provenance_semantic_ids' }],
      [{ version: '20260924180303', name: 'repair_question_provenance_semantic_ids' }]
    )
    expect(result.missing).toEqual([])
    expect(result.timestampAliases).toHaveLength(1)
  })

  test('detects missing duplicate logical migrations by count', () => {
    const result = compareMigrationHistories(
      [
        { version: '1', name: 'duplicate' },
        { version: '2', name: 'duplicate' }
      ],
      [{ version: '9', name: 'duplicate' }]
    )
    expect(result.missing).toEqual([{ version: '2', name: 'duplicate' }])
  })

  test('applies narrowly counted missing-migration exceptions', () => {
    const result = compareMigrationHistories(
      [{ version: '1', name: 'cleanup' }, { version: '2', name: 'required' }],
      [{ version: '9', name: 'required' }],
      { cleanup: { allowedMissing: 1, reason: 'staging-only data shape' } }
    )
    expect(result.missing).toEqual([])
    expect(result.exceptionsUsed).toEqual([expect.objectContaining({ name: 'cleanup', count: 1 })])
  })

  test('does not let an exception mask more missing copies than allowed', () => {
    const result = compareMigrationHistories(
      [{ version: '1', name: 'duplicate' }, { version: '2', name: 'duplicate' }],
      [],
      { duplicate: { allowedMissing: 1, reason: 'one permitted' } }
    )
    expect(result.missing).toHaveLength(1)
  })

  test('reports remote-only migrations without treating them as missing', () => {
    const result = compareMigrationHistories(
      [{ version: '1', name: 'canonical' }],
      [{ version: '1', name: 'canonical' }, { version: '2', name: 'staging_only' }]
    )
    expect(result.missing).toEqual([])
    expect(result.extra).toEqual([{ name: 'staging_only', count: 1 }])
  })

  test('extracts and validates Supabase project refs from URLs', () => {
    expect(projectRefFromUrl('https://jchfruprqpeypdttvlam.supabase.co')).toBe('jchfruprqpeypdttvlam')
    expect(projectRefFromUrl('https://example.com')).toBeNull()
  })

  test('repository drift exceptions are narrow and auditable', () => {
    const root = path.resolve('.')
    const doc = JSON.parse(fs.readFileSync(path.join(root, 'supabase/migration-drift-exceptions.json'), 'utf8'))
    const staging = doc.jchfruprqpeypdttvlam
    expect(Object.keys(staging)).toEqual(['cleanup_historical_smoke_classes'])
    expect(staging.cleanup_historical_smoke_classes.allowedMissing).toBe(1)
    expect(staging).not.toHaveProperty('seed_federal_school_codes_2026_27_q4')

    const seed = fs.readFileSync(path.join(root, 'supabase/migrations/20261001041910_seed_federal_school_codes_2026_27_q4.sql'), 'utf8')
    expect(seed).toContain('record-count: 6547')
    expect(seed).toContain('59fac0beb0aa9c66f3237c2a22d16a32bdfc64deb390002b008e98c2e5bf136a')

    const cleanup = fs.readFileSync(path.join(root, 'supabase/migrations/20260930210756_cleanup_historical_smoke_classes.sql'), 'utf8')
    expect(cleanup).toContain('delete from public.classes')
    expect(cleanup).not.toMatch(/create\s+table|alter\s+table|create\s+(or\s+replace\s+)?function/i)
  })

  test('CI checks the main baseline on PRs and HEAD after merge', () => {
    const workflow = fs.readFileSync(path.resolve('.github/workflows/supabase-migration-drift.yml'), 'utf8')
    expect(workflow).toContain('fetch-depth: 0')
    expect(workflow).toContain('secrets.STAGING_SECRET')
    expect(workflow).toContain('EXPECTED_SUPABASE_REF: jchfruprqpeypdttvlam')
    expect(workflow).toContain('--ref origin/${{ github.base_ref }}')
    expect(workflow).toContain('--ref HEAD')
    expect(workflow).toContain('supabase/migration-drift-exceptions.json')
  })
})
