const fs = require('fs');
const path = require('path');

describe('SAGE diagnostic survey source-rights resolution', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009231500_resolve_sage_diagnostic_survey_rights.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('resolves SAGE survey to citation plus paraphrase with restricted broader reuse', () => {
    expect(migration).toContain("where id = 'automotive-engine-diagnostic-survey-2012'");
    expect(migration).toContain(
      "license_classification = 'SCHOLARLY_CITATION_PARAPHRASE_ALLOWED_REPRO_STORAGE_AI_COMMERCIAL_RESTRICTED'"
    );
  });

  test('enables only citation and paraphrase', () => {
    expect(migration).toContain('citation_link_allowed = true');
    expect(migration).toContain('paraphrase_summary_allowed = true');
    expect(migration).toContain('direct_reproduction_allowed = false');
    expect(migration).toContain('database_storage_allowed = false');
    expect(migration).toContain('ai_rag_ingestion_allowed = false');
    expect(migration).toContain('commercial_use_allowed = false');
  });

  test('records restricted access and the lack of an independent open license', () => {
    expect(migration).toContain('restricted access');
    expect(migration).toContain('no independent open license');
  });

  test('does not change assessment eligibility', () => {
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
