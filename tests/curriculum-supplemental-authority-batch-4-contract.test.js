const fs = require('fs');
const path = require('path');

describe('supplemental automotive authority batch 4', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009061000_add_supplemental_automotive_authority_batch_4.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('adds five DOE automotive electrification sources', () => {
    [
      'doe-afdc-all-electric-car-architecture',
      'doe-afdc-hybrid-electric-car-architecture',
      'doe-vto-batteries',
      'doe-vto-power-electronics-rd',
      'doe-vto-electric-drive-systems-rd',
    ].forEach((id) => expect(migration).toContain(`'${id}'`));
  });

  test('uses only the current schema-supported source kind', () => {
    const sourceInsert = migration.split('on conflict (id) do update set')[0];
    expect(sourceInsert.match(/'technical-reference'/g)).toHaveLength(5);
    expect(sourceInsert).not.toMatch(
      /'government-reference'|'electric-vehicle-reference'|'battery-reference'/
    );
  });

  test('keeps conservative federal rights on all five sources', () => {
    const sourceInsert = migration.split('on conflict (id) do update set')[0];
    expect(
      sourceInsert.match(/'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT'/g)
    ).toHaveLength(5);
    expect(sourceInsert.match(/true, true, false, false, false, true,/g)).toHaveLength(5);
  });

  test('supplements ten previously single-source electrification and control lessons', () => {
    [
      'ug-aut230-automotive-electronics',
      'ug-aut280-control-systems',
      'ug-aut321-hybrid-lab',
      'ug-aut331-electric-vehicle-lab',
      'ug-hev-foundations',
      'grad-aut530-advanced-ev-systems',
      'grad-aut535-battery-systems',
      'grad-aut540-power-electronics',
      'grad-aut545-energy-management',
      'grad-aut580-control-systems',
      'grad-vehicle-systems-testing',
    ].forEach((lessonId) => expect(migration).toContain(`'${lessonId}'`));
  });

  test('keeps mappings idempotent and assessment-neutral', () => {
    expect(migration).toContain(
      'on conflict (reference_id, lesson_plan_id, role) do update set'
    );
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
