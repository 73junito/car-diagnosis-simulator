const fs = require('fs');
const path = require('path');

describe('GM source-rights resolution', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009224500_resolve_gm_source_rights.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('resolves GM to an explicitly restricted OEM classification', () => {
    expect(migration).toContain("where id = 'gm-pre-post-scan-position-2022'");
    expect(migration).toContain(
      "license_classification = 'OEM_CITATION_ONLY_REUSE_RESTRICTED_BY_TERMS'"
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

  test('records GM terms as the rights basis', () => {
    expect(migration).toContain('General Motors copyright and website terms');
    expect(migration).toContain('without GM written permission');
  });

  test('does not change assessment eligibility', () => {
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
