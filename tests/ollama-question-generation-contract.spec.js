const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

describe('Ollama question generation contract', () => {
  const root = path.resolve(__dirname, '..');
  const generator = fs.readFileSync(
    path.join(root, 'scripts', 'generate-scenario-question-drafts.js'),
    'utf8'
  );
  const agent = fs.readFileSync(
    path.join(root, 'scripts', 'agents', 'automotive-question-agent.js'),
    'utf8'
  );
  const worker = fs.readFileSync(
    path.join(root, 'scripts', 'workers', 'ollama-question-worker.js'),
    'utf8'
  );
  const workflow = fs.readFileSync(
    path.join(root, '.github', 'workflows', 'generate-scenario-question-drafts.yml'),
    'utf8'
  );
  const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260924200000_retire_noncompliant_evidence_sources.sql'),
    'utf8'
  );

  test('workflow uses the ollama GitHub Environment secret without exposing it', () => {
    expect(workflow).toContain('environment: ollama');
    expect(workflow).toContain('secrets.API_GITHUB');
    expect(workflow).toContain('https://ollama.com/api/chat');
    expect(workflow).not.toMatch(/echo\s+.*\$OLLAMA_API_KEY/i);
  });

  test('generation is evidence-bound and draft-only', () => {
    expect(generator).toContain('source.reviewer_approved === true');
    expect(generator).toContain("source.status === 'validated'");
    expect(generator).toContain('runOllamaQuestionWorker');
    expect(generator).toContain('selectDrafts');
    expect(agent).toContain("status: 'draft'");
    expect(agent).toContain('approved: false');
    expect(agent).toContain('human_technical_review_completed: false');
    expect(agent).toContain('human_instructional_review_completed: false');
    expect(worker).toContain('buildQuestionMessages');
    expect(generator).toContain('No rights-verified, reviewer-approved evidence chunks');
    expect(agent).toContain('Google Scholar search-result URL is not a canonical citation');
    expect(agent).toContain('Never invent, guess, alter, or substitute a citation');
    expect(agent).toContain('Preserve the canonical publisher, DOI, institutional-repository, or authoritative source record');
    expect(agent).toContain('omit the question rather than infer');
  });

  test('charging-system has eligible reviewed evidence in dry-run mode', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/generate-scenario-question-drafts.js', '--scenario=charging-system', '--target=8', '--dry-run=true'],
      { cwd: root, encoding: 'utf8' }
    );
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.eligible_source_count).toBeGreaterThan(0);
    expect(report.eligible_chunk_count).toBeGreaterThan(0);
  });

  test('scenario generation fails closed when reviewed evidence is unavailable', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/generate-scenario-question-drafts.js', '--scenario=no-crank', '--target=8', '--dry-run=true'],
      { cwd: root, encoding: 'utf8' }
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('No rights-verified, reviewer-approved evidence chunks');
  });

  test('staging hygiene migration retires blocked and synthetic evidence', () => {
    expect(migration).toContain("'ijert-starter-performance-testbench-2018'");
    expect(migration).toContain("'test-diagnostic-source-001'");
    expect(migration).toContain("set status = 'retired'");
    expect(migration).toContain('approved = false');
    expect(migration).toContain('update public.question_provenance');
  });

  test('workflow never writes generated drafts to Supabase', () => {
    expect(workflow).not.toMatch(/SUPABASE_(SERVICE_ROLE_KEY|DB|SECRET|URL)/);
    expect(workflow).not.toMatch(/psql|supabase db|apply_migration/i);
    expect(workflow).toContain('No database write or automatic approval occurred.');
  });
});
