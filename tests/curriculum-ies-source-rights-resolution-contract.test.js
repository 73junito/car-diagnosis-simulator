const fs = require('fs');
const path = require('path');

describe('IES continuous-improvement source-rights resolution', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009205000_resolve_ies_source_rights.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('moves the IES toolkit to the governed federal public-domain classification', () => {
    expect(migration).toContain(
      "where id = 'ies-continuous-improvement-education-toolkit-2020'"
    );
    expect(migration).toContain(
      "license_classification = 'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT'"
    );
  });

  test('expands only the rights allowed by the existing federal caveat policy', () => {
    expect(migration).toContain('citation_link_allowed = true');
    expect(migration).toContain('paraphrase_summary_allowed = true');
    expect(migration).toContain('direct_reproduction_allowed = false');
    expect(migration).toContain('database_storage_allowed = false');
    expect(migration).toContain('ai_rag_ingestion_allowed = false');
    expect(migration).toContain('commercial_use_allowed = true');
    expect(migration).toContain('attribution_required = true');
    expect(migration).toContain('share_alike_required = false');
  });

  test('records the explicit public-domain basis and preserves third-party boundaries', () => {
    expect(migration).toContain('REL 2021-014');
    expect(migration).toContain('report is in the public domain');
    expect(migration).toContain('third-party works');
    expect(migration).toContain('retain independent rights');
  });

  test('removes the stale citation-only mapping note without changing assessment eligibility', () => {
    expect(migration).toContain(
      "role = 'continuous-improvement-leadership'"
    );
    expect(migration).not.toContain('Citation-only rights controls remain in force');
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
