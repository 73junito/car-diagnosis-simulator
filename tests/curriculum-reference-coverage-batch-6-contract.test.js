const fs = require('fs');
const path = require('path');

describe('curriculum reference coverage expansion batch 6', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009043500_expand_reference_coverage_batch_6.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('adds governed systems, curriculum-design, and improvement sources', () => {
    expect(migration).toContain("'nasa-systems-engineering-handbook-2016'");
    expect(migration).toContain("'openoregon-open-curriculum-development-model'");
    expect(migration).toContain("'ies-continuous-improvement-education-toolkit-2020'");
  });

  test('keeps conservative rights boundaries for government-hosted references', () => {
    expect(migration).toContain("'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT'");
    expect(migration).toContain("'GOVERNMENT_HOSTED_CITATION_ONLY_PENDING_REUSE_REVIEW'");
    expect(migration).toContain(
      "'GOVERNMENT_HOSTED_CITATION_ONLY_PENDING_REUSE_REVIEW',\n  true, false, false, false, false, false,"
    );
  });

  test('records the Open Oregon curriculum source as CC BY 4.0', () => {
    expect(migration).toContain("'CC_BY_4_0'");
    expect(migration).toContain(
      "'CC_BY_4_0',\n  true, true, true, true, true, true,"
    );
  });

  test('covers all three remaining graduate lesson plans with scoped roles', () => {
    expect(migration).toContain("'grad-aut501-integrated-systems'");
    expect(migration).toContain("'systems-integration-foundation'");
    expect(migration).toContain("'grad-curriculum-assessment-design'");
    expect(migration).toContain("'curriculum-alignment-assessment-design'");
    expect(migration).toContain("'grad-technical-instructional-leadership'");
    expect(migration).toContain("'continuous-improvement-leadership'");
  });

  test('keeps mappings idempotent and non-assessment', () => {
    expect(migration).toContain(
      'on conflict (reference_id, lesson_plan_id, role) do update set'
    );
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});