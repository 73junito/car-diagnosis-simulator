const fs = require('fs');
const path = require('path');

describe('supplemental automotive authority batch 3', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009054500_add_supplemental_automotive_authority_batch_3.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('adds the NHTSA 2022 vehicle cybersecurity best-practices source', () => {
    expect(migration).toContain("'nhtsa-cybersecurity-best-practices-modern-vehicles-2022'");
    expect(migration).toContain('Cybersecurity Best Practices for the Safety of Modern Vehicles');
    expect(migration).toContain('National Highway Traffic Safety Administration');
    expect(migration).toContain('2022');
  });

  test('uses the existing schema-supported technical-reference source kind', () => {
    const sourceInsert = migration.split('on conflict (id) do update set')[0];
    expect(sourceInsert).toContain("'technical-reference'");
    expect(sourceInsert).not.toMatch(/'regulatory-reference'|'cybersecurity-reference'/);
  });

  test('keeps the conservative federal-rights posture', () => {
    expect(migration).toContain("'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT'");
    expect(migration).toContain('true, true, false, false, false, true,');
    expect(migration).toContain('third-party material');
  });

  test('supplements seven single-source automotive computing lessons', () => {
    [
      'ug-aut370-embedded-systems',
      'ug-aut380-cybersecurity',
      'ug-aut390-connected-sdv',
      'grad-aut550-automotive-networks',
      'grad-aut555-embedded-ecu',
      'grad-aut570-cybersecurity',
      'grad-aut575-software-defined-vehicle',
    ].forEach((lessonId) => expect(migration).toContain(`'${lessonId}'`));
  });

  test('keeps mappings idempotent and does not grant assessment eligibility', () => {
    expect(migration).toContain(
      'on conflict (reference_id, lesson_plan_id, role) do update set'
    );
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
