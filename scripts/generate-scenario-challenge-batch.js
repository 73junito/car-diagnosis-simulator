'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { runScenarioChallengeWorker } = require('./workers/ollama-scenario-challenge-worker');

const root = path.resolve(__dirname, '..');
const args = Object.fromEntries(
  process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...rest] = arg.slice(2).split('=');
    return [key, rest.join('=')];
  })
);

const batchId = Number(args.batch || 0);
const model = args.model || 'gpt-oss:20b-cloud';
const outputPath = path.resolve(root, args.output || `scenario-challenge-batch-${batchId}.json`);
const dryRun = args['dry-run'] === 'true';
const apiUrl = process.env.OLLAMA_API_URL || 'https://ollama.com/api/chat';
const apiKey = process.env.OLLAMA_API_KEY || '';

if (![1,2,3,4].includes(batchId)) throw new Error('--batch must be 1, 2, 3, or 4.');
if (!dryRun && !apiKey) throw new Error('OLLAMA_API_KEY is required unless --dry-run=true.');

const plan = JSON.parse(fs.readFileSync(
  path.join(root, 'data', 'generated', 'scenario-challenge-batch-plan.json'), 'utf8'
));
const batch = plan.batches.find((item) => item.batch_id === batchId);
if (!batch || batch.target_count !== 50) throw new Error('Batch plan is invalid.');

function loadScriptData(file, expression) {
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = {};
  const fn = new Function('window', `${code}\nreturn ${expression};`);
  return fn(sandbox);
}

const banks = loadScriptData(
  path.join(root, 'data', 'scenario-questions.js'),
  'window.SCENARIO_QUESTIONS'
);
const routeMap = loadScriptData(
  path.join(root, 'data', 'scenario-content-map.js'),
  'window.SCENARIO_CONTENT_MAP'
);

const retainedQuestions = [];
for (const scenarioId of plan.scenario_banks) {
  for (const item of (banks[scenarioId] || [])) {
    retainedQuestions.push({
      scenario_id: scenarioId,
      question_id: item.id || null,
      status: item.status || null,
      question: item.question_text || item.question || '',
      options: {
        A: item.option_a || item.options?.A || '',
        B: item.option_b || item.options?.B || '',
        C: item.option_c || item.options?.C || '',
        D: item.option_d || item.options?.D || ''
      },
      correct_answer: item.correct_answer || null
    });
  }
}

const routeExamples = Object.entries(routeMap).map(([route, bank]) => ({ route, bank }));
const scenarioContext = plan.scenario_banks.map((scenarioId) => ({
  scenario_id: scenarioId,
  routed_examples: routeExamples.filter((row) => row.bank === scenarioId).map((row) => row.route),
  retained_question_count: retainedQuestions.filter((q) => q.scenario_id === scenarioId).length
}));

function validateGenerated(doc) {
  const questions = Array.isArray(doc?.questions) ? doc.questions : [];
  if (questions.length !== 50) throw new Error(`Expected exactly 50 questions; received ${questions.length}.`);

  const counts = Object.fromEntries(plan.scenario_banks.map((id) => [id, 0]));
  const stems = new Set();
  for (const [index, item] of questions.entries()) {
    if (!plan.scenario_banks.includes(item.scenario_id)) throw new Error(`Question ${index + 1} has invalid scenario_id.`);
    counts[item.scenario_id] += 1;
    if (item.status !== 'draft' ||
        item.support_status !== 'synthetic-draft-pending-evidence' ||
        item.eligible_for_training_mix !== false ||
        item.eligible_for_scoring !== false ||
        item.assessment_eligible !== false) {
      throw new Error(`Question ${index + 1} violates draft governance.`);
    }
    if (!['A','B','C','D'].includes(item.correct_answer)) throw new Error(`Question ${index + 1} has invalid correct_answer.`);
    for (const key of ['A','B','C','D']) {
      if (!String(item.options?.[key] || '').trim()) throw new Error(`Question ${index + 1} is missing option ${key}.`);
    }
    if (!Array.isArray(item.claims_to_verify) || item.claims_to_verify.length === 0) {
      throw new Error(`Question ${index + 1} must declare claims_to_verify.`);
    }
    const stem = String(item.question || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (stem.length < 15 || stems.has(stem)) throw new Error(`Question ${index + 1} has an invalid or duplicate stem.`);
    stems.add(stem);
  }

  for (const [scenarioId, expected] of Object.entries(batch.allocation)) {
    if (counts[scenarioId] !== expected) {
      throw new Error(`Scenario ${scenarioId} expected ${expected} questions; received ${counts[scenarioId]}.`);
    }
  }

  return questions.map((item) => ({
    ...item,
    synthetic_draft_id: `${item.scenario_id}-challenge-${crypto.createHash('sha256').update(item.question).digest('hex').slice(0, 12)}`,
    human_technical_review_completed: false,
    human_instructional_review_completed: false,
    evidence_mapping_completed: false,
    citation_validation_completed: false,
    approved: false
  }));
}

if (dryRun) {
  process.stdout.write(JSON.stringify({
    batch_id: batchId,
    target_count: batch.target_count,
    allocation: batch.allocation,
    scenario_count: plan.scenario_banks.length,
    retained_question_count: retainedQuestions.length,
    model,
    governance: plan.governance
  }, null, 2) + '\n');
  process.exit(0);
}

(async () => {
  const { generated, agentVersion } = await runScenarioChallengeWorker({
    apiUrl, apiKey, model,
    batchId,
    batchTarget: batch.target_count,
    allocation: batch.allocation,
    scenarioContext,
    retainedQuestions
  });
  const questions = validateGenerated(generated);
  const result = {
    generator: {
      provider: 'ollama-cloud',
      model,
      agent_version: agentVersion,
      generated_at: new Date().toISOString(),
      batch_id: batchId,
      requested_count: 50,
      returned_count: questions.length
    },
    governance: plan.governance,
    allocation: batch.allocation,
    questions
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`Wrote batch ${batchId} with ${questions.length} synthetic challenge drafts to ${outputPath}`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
