const fs = require('fs');
const path = require('path');

describe('supplemental automotive authority batch 6', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009071000_add_supplemental_automotive_authority_batch_6.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('adds three federal measurement and engine references', () => {
    [
      'nist-si-2019',
      'nist-tn1900-measurement-uncertainty',
      'doe-internal-combustion-engine-basics',
    ].forEach((id) => expect(migration).toContain(`'${id}'`));
  });

  test('keeps conservative federal rights on the three new sources', () => {
    const sourceInsert = migration.split('on conflict (id) do update set')[0];
    expect(sourceInsert.match(/'technical-reference'/g)).toHaveLength(3);
    expect(
      sourceInsert.match(/'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT'/g)
    ).toHaveLength(3);
    expect(sourceInsert.match(/true, true, false, false, false, true,/g)).toHaveLength(3);
  });

  test('reuses existing automotive, OSHA, scholarly, and DOE sources without duplicating them', () => {
    [
      'gm-pre-post-scan-position-2022',
      'osha-motor-vehicle-safety-aspects-2026',
      'automotive-engine-diagnostic-survey-2012',
      'doe-vto-electric-drive-systems-rd',
    ].forEach((id) => expect(migration).toContain(`'${id}'`));

    expect(migration).not.toContain(
      "'gm-pre-post-scan-position-2022',\n  'Pre- and Post-Scan"
    );
    expect(migration).not.toContain(
      "'osha-motor-vehicle-safety-aspects-2026',\n  'Motor Vehicle Safety"
    );
  });

  test('supplements all nine remaining single-source lessons', () => {
    [
      'grad-applied-research-literature',
      'grad-aut520-data-analytics',
      'grad-aut590-technology-seminar',
      'ug-aut110-automotive-math',
      'ug-aut115-measurement-instrumentation',
      'ug-aut130-engine-systems',
      'ug-aut180-service-information',
      'ug-aut400-research-methods',
      'ug-aut420-internship',
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
