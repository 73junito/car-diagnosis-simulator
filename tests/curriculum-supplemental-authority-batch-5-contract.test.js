const fs = require('fs');
const path = require('path');

describe('supplemental automotive authority batch 5', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009064000_add_supplemental_automotive_authority_batch_5.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('adds three federal technical references', () => {
    [
      'nasa-systems-modeling-handbook-2025',
      'nhtsa-automated-driving-systems-guidance',
      'nist-digital-twins-advanced-manufacturing',
    ].forEach((id) => expect(migration).toContain(`'${id}'`));
  });

  test('keeps conservative federal rights on new sources', () => {
    const sourceInsert = migration.split('on conflict (id) do update set')[0];
    expect(sourceInsert.match(/'technical-reference'/g)).toHaveLength(3);
    expect(
      sourceInsert.match(/'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT'/g)
    ).toHaveLength(3);
    expect(sourceInsert.match(/true, true, false, false, false, true,/g)).toHaveLength(3);
  });

  test('reuses existing authoritative sources rather than duplicating them', () => {
    expect(migration).toContain("'automotive-engine-diagnostic-survey-2012'");
    expect(migration).toContain("'nhtsa-fmvss-126-electronic-stability-control'");
    expect(migration).not.toContain(
      "'automotive-engine-diagnostic-survey-2012',\n  'A survey on diagnostic methods for automotive engines'"
    );
    expect(migration).not.toContain(
      "'nhtsa-fmvss-126-electronic-stability-control',\n  'FMVSS No. 126"
    );
  });

  test('supplements eleven previously single-source lessons', () => {
    [
      'ug-aut200-engine-systems-ii',
      'ug-aut201-engine-systems-ii-lab',
      'ug-aut260-vehicle-dynamics',
      'ug-aut450-capstone-i',
      'ug-aut451-capstone-ii',
      'grad-aut501-integrated-systems',
      'grad-aut515-systems-modeling',
      'grad-aut560-adas-perception',
      'grad-aut565-autonomous-systems',
      'grad-aut585-digital-twins',
      'grad-diagnostic-evidence-analysis',
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
