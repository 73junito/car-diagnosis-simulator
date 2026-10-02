'use strict';

const fs = require('fs');
const path = require('path');
const { runScenarioChallengeWorker } = require('./workers/ollama-scenario-challenge-worker');
const { validateGenerated } = require('./lib/scenario-challenge-validator');

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
const timeoutMs = Number(args['timeout-ms'] || process.env.OLLAMA_CHALLENGE_TIMEOUT_MS || 600000);

if (![1,2,3,4].includes(batchId)) throw new Error('--batch must be 1, 2, 3, or 4.');
if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 2147483647) throw new Error('--timeout-ms must be between 1000 and 2147483647 milliseconds.');
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


if (dryRun) {
  process.stdout.write(JSON.stringify({
    batch_id: batchId,
    target_count: batch.target_count,
    allocation: batch.allocation,
    scenario_count: plan.scenario_banks.length,
    retained_question_count: retainedQuestions.length,
    model,
    timeout_ms: timeoutMs,
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
    retainedQuestions,
    timeoutMs
  });
  const questions = validateGenerated({ doc: generated, plan, batch });
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
