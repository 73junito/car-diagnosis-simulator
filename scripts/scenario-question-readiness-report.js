const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const requiredPerScenario = 20;
const liveBaseArg = process.argv.find((arg) => arg.startsWith('--live-base='));
const liveBase = liveBaseArg ? liveBaseArg.split('=')[1].replace(/\/$/, '') : null;

function loadBrowserData() {
  const context = { window: {}, console: { warn() {}, log() {}, error() {} } };
  context.window.window = context.window;
  vm.createContext(context);
  for (const file of [
    'data/scenarios.js',
    'data/scenario-content-map.js',
    'data/analysis-levels.js',
    'data/scenario-registry.js',
    'data/scenario-questions.js'
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context.window;
}

async function getApprovedCount(questionBankId) {
  if (!liveBase) return null;
  const url = `${liveBase}/api/scenario-questions-approved?scenarioId=${encodeURIComponent(questionBankId)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${questionBankId}`);
  const payload = await response.json();
  return Number(payload.count ?? (Array.isArray(payload.questions) ? payload.questions.length : 0));
}
(async () => {
  const data = loadBrowserData();
  const staticBanks = data.SCENARIO_QUESTIONS || {};
  const rows = [];

  for (const scenario of data.SCENARIO_REGISTRY || []) {
    const questionBankId = scenario.questionBankId;
    const staticBank = staticBanks[questionBankId] || [];
    const approved = await getApprovedCount(questionBankId);
    rows.push({
      scenario_key: scenario.scenario_key,
      question_bank_id: questionBankId,
      url: scenario.route,
      required_questions: requiredPerScenario,
      static_records: staticBank.length,
      static_approved: staticBank.filter((q) => String(q.status || '').toLowerCase() === 'approved').length,
      live_approved: approved,
      gap_to_20: approved === null ? null : Math.max(0, requiredPerScenario - approved),
      ready: approved === null ? null : approved >= requiredPerScenario
    });
  }

  const summary = {
    scenarios: rows.length,
    required_per_scenario: requiredPerScenario,
    total_required: rows.length * requiredPerScenario,
    live_ready: rows.filter((row) => row.ready === true).length,
    live_approved_total: rows.reduce((sum, row) => sum + (row.live_approved || 0), 0)
  };

  process.stdout.write(JSON.stringify({ summary, rows }, null, 2) + '\n');
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
