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
    expect(result.migrations).toHaveLength(106)

    const versions = result.migrations.map((m) => m.version)
    expect(new Set(versions).size).toBe(106)
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

// Issue #1072 prevention: a missing canonical migration must be reported as
// missing (never "repaired"), and history must never be recorded while the
// materialized schema is still stale.
describe('canonical migration gate coverage (issue #1072)', () => {
  test('reports the lagging canonical migration when the remote is behind', () => {
    const result = compareMigrationHistories(
      [
        { version: '20261013005905', name: 'add_diagnostic_copilot_stage2' },
        { version: '20261013190000', name: 'retire_external_certification_taxonomy' }
      ],
      [{ version: '20261013005905', name: 'add_diagnostic_copilot_stage2' }]
    )
    expect(result.missing.map((m) => m.version)).toEqual(['20261013190000'])
    expect(result.extra).toEqual([])
    expect(result.timestampAliases).toEqual([])
  })

  test('the pending taxonomy migration is canonical in this repository', () => {
    const versions = canonicalRepositoryMigrations('WORKTREE').migrations.map((m) => m.version)
    expect(versions).toContain('20261013190000')
  })
})

describe('migration application gate (issue #1072)', () => {
  const { evaluateApplicationGate } = require('../scripts/verify-supabase-migration-drift.js')

  const VERSION = '20261013190000'
  const expected = {
    pre: { legacy_prefix_columns: ['scenario_catalog', 'scenario_questions'], diagnostic_area_columns: [] },
    post: { legacy_prefix_columns: [], diagnostic_area_columns: ['scenario_catalog', 'scenario_questions'] }
  }

  test('refuses a history repair while the materialized schema is still stale', () => {
    const gate = evaluateApplicationGate({
      history: [{ version: VERSION, name: 'retire_external_certification_taxonomy' }],
      schemaProbe: expected.pre,
      version: VERSION,
      expected
    })
    expect(gate.decision).toBe('history_recorded_but_schema_stale')
    expect(gate.ok).toBe(false)
    expect(gate.requiresTrackedApplication).toBe(true)
    expect(gate.reason).toMatch(/apply the canonical SQL/i)
  })

  test('requires tracked application when unapplied and still in the pre-state', () => {
    const gate = evaluateApplicationGate({ history: [], schemaProbe: expected.pre, version: VERSION, expected })
    expect(gate.decision).toBe('apply_required')
    expect(gate.ok).toBe(true)
    expect(gate.requiresTrackedApplication).toBe(true)
  })

  test('reports already_applied when recorded and in the post-state', () => {
    const gate = evaluateApplicationGate({
      history: [{ version: VERSION, name: 'retire_external_certification_taxonomy' }],
      schemaProbe: expected.post,
      version: VERSION,
      expected
    })
    expect(gate.decision).toBe('already_applied')
    expect(gate.ok).toBe(true)
    expect(gate.requiresTrackedApplication).toBe(false)
  })

  test('flags a materialized migration that was never recorded', () => {
    const gate = evaluateApplicationGate({ history: [], schemaProbe: expected.post, version: VERSION, expected })
    expect(gate.decision).toBe('schema_applied_but_history_missing')
    expect(gate.ok).toBe(false)
    expect(gate.reason).toMatch(/evidence of the original tracked application/i)
  })

  test('is indeterminate when the probe matches neither expected state', () => {
    const gate = evaluateApplicationGate({
      history: [],
      schemaProbe: { legacy_prefix_columns: ['scenario_questions'], diagnostic_area_columns: [] },
      version: VERSION,
      expected
    })
    expect(gate.decision).toBe('indeterminate')
    expect(gate.ok).toBe(false)
  })

  test('stays indeterminate without a schema probe rather than guessing', () => {
    const gate = evaluateApplicationGate({ history: [], schemaProbe: null, version: VERSION, expected })
    expect(gate.decision).toBe('indeterminate')
    expect(gate.ok).toBe(false)
  })
})

