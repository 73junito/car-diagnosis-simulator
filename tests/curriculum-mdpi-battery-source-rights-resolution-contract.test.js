const fs = require('fs');
const path = require('path');

describe('MDPI battery source-rights resolution', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009214000_resolve_mdpi_battery_source_rights.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('moves the battery review to CC BY 4.0', () => {
    expect(migration).toContain(
      "where id = 'scholar-battery-soc-soh-review-2023'"
    );
    expect(migration).toContain("license_classification = 'CC_BY_4_0'");
  });

  test('enables the rights granted by CC BY 4.0', () => {
    [
      'citation_link_allowed = true',
      'paraphrase_summary_allowed = true',
      'direct_reproduction_allowed = true',
      'database_storage_allowed = true',
      'ai_rag_ingestion_allowed = true',
      'commercial_use_allowed = true',
      'attribution_required = true',
      'share_alike_required = false',
    ].forEach((expected) => expect(migration).toContain(expected));
  });

  test('records attribution and third-party-material boundaries', () => {
    expect(migration).toContain('Open Access');
    expect(migration).toContain('Creative Commons Attribution 4.0 International');
    expect(migration).toContain('Separately credited third-party');
  });

  test('does not change assessment eligibility', () => {
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
