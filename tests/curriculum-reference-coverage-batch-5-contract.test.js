const fs = require('fs');
const path = require('path');

describe('curriculum reference coverage expansion batch 5', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009042000_expand_reference_coverage_batch_5.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('adds governed OSHA and EPA reference records', () => {
    expect(migration).toContain("'osha-motor-vehicle-safety-aspects-2026'");
    expect(migration).toContain("'epa-automotive-sectors-regulatory-information-2026'");
    expect(migration).toContain("'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT'");
  });

  test('keeps new government references citation-and-summary only', () => {
    const sourceRows = [...migration.matchAll(
      /'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',\n\s+true, true, false, false, false, true,/g
    )];
    expect(sourceRows).toHaveLength(2);
  });

  test('covers both remaining undergraduate lessons with appropriate roles', () => {
    expect(migration).toContain("'ug-aut101-foundations'");
    expect(migration).toContain("'safety-professional-foundation'");
    expect(migration).toContain("'professional-documentation'");
    expect(migration).toContain("'ug-aut105-safety-professional-practice'");
    expect(migration).toContain("'shop-safety-foundation'");
    expect(migration).toContain("'environmental-compliance-reference'");
  });

  test('keeps the mapping operation idempotent and non-assessment', () => {
    expect(migration).toContain(
      'on conflict (reference_id, lesson_plan_id, role) do update set'
    );
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
