const fs = require('fs')
const path = require('path')

const root = process.cwd()
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260930145732_retire_legacy_student_progress.sql'),
  'utf8'
)

describe('legacy progress retirement migration contract', () => {
  test('is fail closed on row identity and dependency drift', () => {
    expect(migration).toContain('legacy_rows <> 80')
    expect(migration).toContain('non_anonymous_rows <> 0')
    expect(migration).toContain('external_fk_count <> 0')
    expect(migration).toContain('direct_view_count <> 3')
    expect(migration).toContain('second_level_view_count <> 1')
    expect(migration).toContain('third_level_view_count <> 0')
  })

  test('drops dependent views deepest first and uses RESTRICT only', () => {
    expect(migration).toContain("drop view %I.%I restrict")
    expect(migration).toContain('drop table public.question_attempts restrict')
    expect(migration).not.toMatch(/\bcascade\b/i)
  })

  test('uses bounded lock and statement timeouts', () => {
    expect(migration).toContain("set local lock_timeout = '5s'")
    expect(migration).toContain("set local statement_timeout = '30s'")
  })

  test('fresh environments remain unchanged when the legacy table is absent', () => {
    expect(migration).toContain("legacy_table regclass := to_regclass('public.question_attempts')")
    expect(migration).toContain('if legacy_table is null then')
    expect(migration).toContain('return;')
  })
})
