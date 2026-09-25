const fs = require('fs');
const path = require('path');

describe('classroom policy migration idempotency', () => {
  const sql = fs.readFileSync(
    path.resolve(__dirname, '..', 'supabase', 'migrations', '20260924052734_restore_classroom_api_schema.sql'),
    'utf8'
  ).toLowerCase();

  const policies = [
    ['classes', 'classes_select_owner'],
    ['classes', 'classes_insert_owner'],
    ['classes', 'classes_update_owner'],
    ['classes', 'classes_delete_owner'],
    ['enrollments', 'enrollments_select_member_or_owner'],
    ['enrollments', 'enrollments_insert_self_or_owner'],
    ['replays', 'replays_select_own'],
    ['replays', 'replays_insert_own'],
    ['completions', 'completions_select_own'],
    ['completions', 'completions_insert_own'],
    ['assignments', 'assignments_select_class_owner'],
    ['assignments', 'assignments_insert_class_owner']
  ];

  test.each(policies)('%s.%s is safely replaceable', (table, policy) => {
    const drop = `drop policy if exists "${policy}" on public.${table};`;
    const create = `create policy "${policy}" on public.${table}`;
    expect(sql).toContain(drop);
    expect(sql).toContain(create);
    expect(sql.indexOf(drop)).toBeLessThan(sql.indexOf(create));
  });

  test('classroom tables remain create-if-missing', () => {
    for (const table of ['classes', 'enrollments', 'replays', 'completions', 'assignments']) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });
});
