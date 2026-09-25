const fs = require('fs');
const path = require('path');

describe('charging-system citation validation contract', () => {
  const root = path.resolve(__dirname, '..');
  const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260925021000_prepare_charging_system_citation_validation.sql'),
    'utf8'
  );
  const workflow = fs.readFileSync(
    path.join(root, '.github', 'workflows', 'validate-staging-citations.yml'),
    'utf8'
  );

  test('retained questions are prepared for validation without approval', () => {
    expect(migration).toContain("status = 'validated'");
    expect(migration).toContain("'technical_review_complete', false");
    expect(migration).toContain("'instructional_review_complete', false");
    expect(migration).not.toContain("status = 'approved'");
  });

  test('citation quotes are synchronized to approved chunk excerpts', () => {
    expect(migration).toContain('set quote = sc.text_excerpt');
    expect(migration).toContain("qc.role in ('supports-answer','supports-explanation')");
  });

  test('required validation checklist fields are explicit', () => {
    for (const field of [
      'answer_verified',
      'explanation_verified',
      'citation_matches_excerpt',
      'license_ok'
    ]) {
      expect(migration).toContain(`'${field}', true`);
    }
  });

  test('workflow targets staging secrets only', () => {
    expect(workflow).toContain('environment: jchfruprqpeypdttvlam_staging');
    expect(workflow).toContain('secrets.STAGING_URL');
    expect(workflow).toContain('secrets.STAGING_SECRET');
    expect(workflow).not.toMatch(/PRODUCTION_(URL|SECRET|KEY)/);
  });

  test('workflow invokes deterministic validator and preserves approval separation', () => {
    expect(workflow).toContain('node scripts/validate-citations.js');
    expect(workflow).toContain('Citation validation does not approve questions.');
  });
});
