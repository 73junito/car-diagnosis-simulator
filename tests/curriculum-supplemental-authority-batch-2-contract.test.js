const fs = require('fs');
const path = require('path');

describe('supplemental automotive authority batch 2', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009051500_add_supplemental_automotive_authority_batch_2.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('adds six citation-only automotive and scholarly source records', () => {
    [
      'bosch-alternator-technical-poster-2020',
      'automotive-engine-diagnostic-survey-2012',
      'sae-nissan-can-diagnostic-flow-2014',
      'icar-adas-diagnostic-process-2025',
      'scholar-battery-soc-soh-review-2023',
      'gm-pre-post-scan-position-2022',
    ].forEach((id) => expect(migration).toContain(`'${id}'`));
  });

  test('uses only schema-supported source kinds', () => {
    const sourceInsert = migration.split('on conflict (id) do update set')[0];
    expect(sourceInsert.match(/'technical-reference'/g)).toHaveLength(6);
    expect(sourceInsert).not.toMatch(
      /'regulatory-reference'|'oer-course-reference'|'scholarly-reference'/
    );
  });

  test('keeps every new source citation-only and non-ingestible', () => {
    const sourceInsert = migration.split('on conflict (id) do update set')[0];
    expect(sourceInsert.match(/true, false, false, false, false, false,/g)).toHaveLength(6);
  });

  test('supplements eight high-priority undergraduate lessons', () => {
    [
      'ug-electrical-charging-system',
      'ug-aut240-electrical-systems-ii',
      'ug-engine-performance-foundations',
      'ug-aut250-automotive-diagnostics-i',
      'ug-aut300-advanced-diagnostics',
      'ug-aut310-network-communications',
      'ug-aut340-battery-management',
      'ug-aut350-adas',
    ].forEach((lessonId) => expect(migration).toContain(`'${lessonId}'`));
  });

  test('preserves SAE no-AI and metadata-only rights boundaries', () => {
    expect(migration).toContain("'SAE_CITATION_ONLY_NO_AI_REUSE'");
    expect(migration).toContain("'PROPRIETARY_CITATION_ONLY_REUSE_UNVERIFIED'");
    expect(migration).toContain("'SCHOLARLY_CITATION_ONLY_REUSE_UNVERIFIED'");
    expect(migration).toContain("'OEM_CITATION_ONLY_REUSE_UNVERIFIED'");
  });

  test('keeps mappings idempotent and does not grant assessment eligibility', () => {
    expect(migration).toContain(
      'on conflict (reference_id, lesson_plan_id, role) do update set'
    );
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
