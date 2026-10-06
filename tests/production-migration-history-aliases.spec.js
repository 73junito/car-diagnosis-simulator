'use strict';

const fs = require('fs');
const path = require('path');

describe('production migration history aliases', () => {
  const root = path.resolve(__dirname, '..');

  const aliases = [
    {
      alias: '20261003024437_add_scenario_challenge_review_artifacts.sql',
      canonical: '20261003023000_add_scenario_challenge_review_artifacts.sql',
    },
    {
      alias: '20261005035043_create_orchestration_persistence_rpc.sql',
      canonical: '20261005031812_create_orchestration_persistence_rpc.sql',
    },
    {
      alias: '20261006035521_add_native_governed_question_drafts.sql',
      canonical: '20261006033456_add_native_governed_question_drafts.sql',
    },
  ];

  test.each(aliases)('$alias is a no-op alias to $canonical', ({ alias, canonical }) => {
    const aliasSql = fs.readFileSync(path.join(root, 'supabase', 'migrations', alias), 'utf8');
    const canonicalSql = fs.readFileSync(path.join(root, 'supabase', 'migrations', canonical), 'utf8');

    expect(aliasSql).toContain('Production migration-history compatibility alias');
    expect(aliasSql).toContain(canonical);
    expect(aliasSql).toContain('intentionally a no-op');
    expect(aliasSql).not.toMatch(/\b(create|alter|drop|insert|update|delete|grant|revoke)\b\s+(table|schema|function|view|policy|role|into|on)/i);

    expect(canonicalSql.length).toBeGreaterThan(100);
  });
});
