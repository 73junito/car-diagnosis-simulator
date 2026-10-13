const fs = require('fs');
const path = require('path');

describe('I-CAR source-rights resolution', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009221500_resolve_icar_source_rights.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('resolves I-CAR to an explicitly restricted proprietary classification', () => {
    expect(migration).toContain("where id = 'icar-adas-diagnostic-process-2025'");
    expect(migration).toContain(
      "license_classification = 'PROPRIETARY_CITATION_ONLY_REUSE_RESTRICTED_BY_TERMS'"
    );
  });

  test('keeps all broader reuse permissions disabled', () => {
    expect(migration).toContain('citation_link_allowed = true');
    expect(migration).toContain('paraphrase_summary_allowed = false');
    expect(migration).toContain('direct_reproduction_allowed = false');
    expect(migration).toContain('database_storage_allowed = false');
    expect(migration).toContain('ai_rag_ingestion_allowed = false');
    expect(migration).toContain('commercial_use_allowed = false');
  });

  test('records the terms-based restriction', () => {
    expect(migration).toContain('I-CAR Terms and Conditions');
    expect(migration).toContain('without I-CAR permission');
  });

  test('does not change assessment eligibility', () => {
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
