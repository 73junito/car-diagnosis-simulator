const fs = require('fs');
const path = require('path');

describe('Bosch source-rights resolution', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009223500_resolve_bosch_source_rights.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('resolves Bosch to an explicitly restricted proprietary classification', () => {
    expect(migration).toContain("where id = 'bosch-alternator-technical-poster-2020'");
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

  test('records Bosch legal terms as the rights basis', () => {
    expect(migration).toContain('Bosch Mobility Aftermarket legal notices');
    expect(migration).toContain('grants no license');
    expect(migration).toContain('requires consent');
  });

  test('does not change assessment eligibility', () => {
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
