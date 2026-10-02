const fs = require('fs');
const path = require('path');
const { buildGenerationChunks } = require('../scripts/lib/scenario-challenge-chunks');

describe('Ollama scenario challenge batch contract', () => {
  const root = path.resolve(__dirname, '..');
  const plan = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'generated', 'scenario-challenge-batch-plan.json'),
    'utf8'
  ));
  const agent = fs.readFileSync(
    path.join(root, 'scripts', 'agents', 'scenario-challenge-question-agent.js'),
    'utf8'
  );
  const validator = fs.readFileSync(
    path.join(root, 'scripts', 'lib', 'scenario-challenge-validator.js'),
    'utf8'
  );
  const workflow = fs.readFileSync(
    path.join(root, '.github', 'workflows', 'generate-scenario-challenge-batches.yml'),
    'utf8'
  );

  test('defines exactly four batches of fifty across all 21 scenario banks', () => {
    expect(plan.batch_count).toBe(4);
    expect(plan.batch_size).toBe(50);
    expect(plan.total_questions).toBe(200);
    expect(plan.scenario_banks).toHaveLength(21);
    expect(plan.batches).toHaveLength(4);

    for (const batch of plan.batches) {
      expect(batch.target_count).toBe(50);
      expect(Object.keys(batch.allocation).sort()).toEqual([...plan.scenario_banks].sort());
      expect(Object.values(batch.allocation).reduce((sum, n) => sum + n, 0)).toBe(50);
      for (const count of Object.values(batch.allocation)) {
        expect([2, 3]).toContain(count);
      }
    }

    expect(Object.values(plan.final_per_scenario).reduce((sum, n) => sum + n, 0)).toBe(200);
    for (const count of Object.values(plan.final_per_scenario)) {
      expect([9, 10]).toContain(count);
    }
  });

  test('shards each 50-question batch into bounded chunks without changing allocation', () => {
    for (const batch of plan.batches) {
      const chunks = buildGenerationChunks({
        allocation: batch.allocation,
        scenarioOrder: plan.scenario_banks,
        maxQuestions: 12
      });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.reduce((sum, chunk) => sum + chunk.target_count, 0)).toBe(50);
      for (const chunk of chunks) {
        expect(chunk.target_count).toBeLessThanOrEqual(12);
      }

      const rebuilt = Object.assign({}, ...chunks.map((chunk) => chunk.allocation));
      expect(rebuilt).toEqual(batch.allocation);
    }
  });

  test('asks for challenging distractors without permitting misleading or ambiguous items', () => {
    expect(agent).toContain('deceptively challenging but fair');
    expect(agent).toContain('plausible near-misses');
    expect(agent).toContain('exactly one answer remains defensibly correct');
    expect(agent).toContain('Do not use trick wording');
    expect(agent).toContain('no_unsupported_numeric_specs');
  });

  test('keeps synthetic questions fail-closed until evidence and human review', () => {
    expect(plan.governance.support_status).toBe('synthetic-draft-pending-evidence');
    expect(plan.governance.auto_approval).toBe(false);
    expect(plan.governance.eligible_for_training_mix).toBe(false);
    expect(plan.governance.eligible_for_scoring).toBe(false);
    expect(plan.governance.assessment_eligible).toBe(false);

    expect(validator).toContain("evidence_mapping_completed: false");
    expect(validator).toContain("citation_validation_completed: false");
    expect(validator).toContain("approved: false");
    expect(workflow).toContain('not eligible for training-bank mixing');
  });

  test('passes free-form dispatch values through environment variables before shell use', () => {
    expect(workflow).toContain('CHALLENGE_MODEL: ${{ inputs.model }}');
    expect(workflow).toContain('CHALLENGE_BATCH_ID: ${{ inputs.batch_id }}');
    expect(workflow).toContain("OLLAMA_CHALLENGE_TIMEOUT_MS: '600000'");
    expect(workflow).toContain('--model="$CHALLENGE_MODEL"');
    expect(workflow).not.toContain('--model="${{ inputs.model }}"');
  });

  test('gives large Ollama generations an explicit configurable timeout', () => {
    const generator = fs.readFileSync(
      path.join(root, 'scripts', 'generate-scenario-challenge-batch.js'),
      'utf8'
    );

    expect(generator).toContain('OLLAMA_CHALLENGE_TIMEOUT_MS || 600000');
    expect(generator).toContain('timeoutMs');
    expect(generator).toContain('timeout_ms: timeoutMs');
    expect(generator).toContain('timeoutMs > 2147483647');
    expect(generator).toContain('buildGenerationChunks');
    expect(generator).toContain('maxQuestions: 12');
    expect(generator).toContain('remainingMs');
  });
});
