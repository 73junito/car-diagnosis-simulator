const fs = require('fs')
const path = require('path')
const {
  parseMigrationPath,
  compareMigrationHistories,
  canonicalRepositoryMigrations,
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

  test('rejects timestamp-renamed logical equivalents', () => {
    const result = compareMigrationHistories(
      [{ version: '20260924180000', name: 'repair_question_provenance_semantic_ids' }],
      [{ version: '20260924180303', name: 'repair_question_provenance_semantic_ids' }]
    )
    expect(result.missing).toHaveLength(1)
    expect(result.extra).toHaveLength(1)
    expect(result.timestampAliases).toEqual([
      {
        name: 'repair_question_provenance_semantic_ids',
        repository: ['20260924180000'],
        remote: ['20260924180303']
      }
    ])
  })

  test('detects remote-only migration records', () => {
    const result = compareMigrationHistories(
      [{ version: '1', name: 'canonical' }],
      [{ version: '1', name: 'canonical' }, { version: '2', name: 'staging_only' }]
    )
    expect(result.missing).toEqual([])
    expect(result.extra).toEqual([{ version: '2', name: 'staging_only' }])
  })

  test('requires exact version and name parity', () => {
    const result = compareMigrationHistories(
      [{ version: '1', name: 'a' }, { version: '2', name: 'b' }],
      [{ version: '1', name: 'a' }, { version: '2', name: 'b' }]
    )
    expect(result).toEqual({ missing: [], extra: [], timestampAliases: [] })
  })

  test('extracts and validates Supabase project refs from URLs', () => {
    expect(projectRefFromUrl('https://jchfruprqpeypdttvlam.supabase.co')).toBe('jchfruprqpeypdttvlam')
    expect(projectRefFromUrl('https://example.com')).toBeNull()
  })

  test('repository contains no migration bloat after reconciliation', () => {
    const result = canonicalRepositoryMigrations('WORKTREE')
    expect(result.ignoredBloat).toEqual([])

    // Derived from the reviewed integrity baseline rather than a hard-coded
    // count. Adding a canonical migration must keep the baseline and the
    // discovered set in agreement instead of breaking a literal; duplicate
    // detection is preserved by the Set comparison below.
    const baseline = JSON.parse(fs.readFileSync(path.join(
      path.resolve('.'),
      'docs/database/migration-integrity-baseline.json'
    ), 'utf8'))
    const baselinedVersions = baseline.migrations.map((entry) => entry.version)

    expect(baseline.canonicalDirectory).toBe('supabase/migrations')
    expect(baselinedVersions.length).toBeGreaterThan(0)
    expect(result.migrations).toHaveLength(baselinedVersions.length)

    const versions = result.migrations.map((m) => m.version)
    expect(new Set(versions).size).toBe(baselinedVersions.length)
    expect([...versions].sort()).toEqual([...baselinedVersions].sort())
    expect(versions).toContain('20260930210756')
    expect(versions).toContain('20261011220034')
    expect(versions).toContain('20261012031851')
    expect(versions).toContain('20261012083703')
    expect(versions).toContain('20261012090441')
    expect(versions).toContain('20261012092021')
    expect(versions).toContain('20261012094800')
    expect(versions).toContain('20261012195501')
    expect(versions).toContain('20261012205000')
    expect(versions).toContain('20261012210213')
    expect(versions).toContain('20261012212214')
    expect(versions).toContain('20261012223500')
    expect(versions).toContain('20261012224500')
    expect(versions).toContain('20261013005905')
    expect(versions).not.toContain('20260930025324')
  })

  test('cleanup migration remains guarded and destructive only to smoke fixtures', () => {
    const cleanup = fs.readFileSync(path.join(
      path.resolve('.'),
      'supabase/migrations/20260930210756_cleanup_historical_smoke_classes.sql'
    ), 'utf8')
    expect(cleanup).toContain('delete from public.classes')
    expect(cleanup).toContain("name ~ '^Smoke Test Class [0-9]+$'")
    expect(cleanup).not.toMatch(/create\s+table|alter\s+table|create\s+(or\s+replace\s+)?function/i)
  })

  test('CI verifies both staging and production migration parity', () => {
    const workflow = fs.readFileSync(path.resolve('.github/workflows/supabase-migration-drift.yml'), 'utf8')
    expect(workflow).toContain('environment: jchfruprqpeypdttvlam_staging')
    expect(workflow).toContain('EXPECTED_SUPABASE_REF: jchfruprqpeypdttvlam')
    expect(workflow).toContain('environment: pffdgqpynpbffbcnxmum_production')
    expect(workflow).toContain('EXPECTED_SUPABASE_REF: pffdgqpynpbffbcnxmum')
    expect(workflow).toContain('Check staging migration parity with PR base')
    expect(workflow).toContain('Check production migration parity with PR base')
    expect(workflow).not.toContain('origin/${{ github.base_ref }}')
    expect((workflow.match(/verify-supabase-migration-drift\.js --ref HEAD/g) || []).length).toBe(2)
    expect((workflow.match(/github\.event\.pull_request\.base\.sha/g) || []).length).toBe(2)
    expect(workflow).not.toContain('migration-drift-exceptions.json')
  })
})
