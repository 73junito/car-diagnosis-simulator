const fs = require('fs');
const path = require('path');

describe('SAE source-rights resolution', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009230000_resolve_sae_source_rights.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('resolves SAE to citation plus paraphrase with permission-required controls', () => {
    expect(migration).toContain("where id = 'sae-nissan-can-diagnostic-flow-2014'");
    expect(migration).toContain(
      "license_classification = 'SAE_CITATION_PARAPHRASE_ALLOWED_REPRO_STORAGE_AI_PERMISSION_REQUIRED'"
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

  test('records direct SAE copyright guidance and case-by-case AI/storage review', () => {
    expect(migration).toContain('Bernadette Harris-Terrill');
    expect(migration).toContain('2026-09-29');
    expect(migration).toContain('case-by-case evaluation');
  });

  test('does not change assessment eligibility', () => {
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
