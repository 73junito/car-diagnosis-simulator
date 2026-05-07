const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SCENARIOS_PATH = path.join(__dirname, '..', 'data', 'scenarios.js');

function loadScenarios() {
  const code = fs.readFileSync(SCENARIOS_PATH, 'utf8');
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(code, sandbox, { filename: SCENARIOS_PATH });
  } catch (err) {
    console.error('Error executing scenarios file:', err.message);
    process.exit(2);
  }
  const scenarios = sandbox.window.scenarios;
  const categories = sandbox.window.SCENARIO_CATEGORIES || [];
  return { scenarios, categories };
}

function validate() {
  const { scenarios, categories } = loadScenarios();
  if (!Array.isArray(scenarios)) {
    console.error('No scenarios array found in', SCENARIOS_PATH);
    process.exit(2);
  }

  const requiredMetadata = ['aseArea','vehicleType','faultType','diagnosticMode','requiredTools','safetyLevel'];
  const scenarioErrors = {};
  const metaCounts = {};
  requiredMetadata.forEach(k => metaCounts[k] = 0);

  scenarios.forEach((s, idx) => {
    const ctx = `scenario[id=${s && s.id}]`;
    const local = [];
    if (!s) { local.push('empty'); scenarioErrors[ctx] = local; return; }
    if (s.id === undefined || s.id === null) local.push('missing id');
    if (!s.symptoms || typeof s.symptoms !== 'string') local.push('missing or invalid symptoms');
    if (!s.fault && !s.faults) local.push("missing fault (expected 'fault' or 'faults')");
    if ((!s.tests || typeof s.tests !== 'object') && !Array.isArray(s.steps)) local.push("missing tests object or procedural 'steps'");
    if (!s.symptomCategory) local.push('missing symptomCategory');
    else if (!categories.includes(s.symptomCategory)) local.push(`unknown symptomCategory '${s.symptomCategory}'`);

    // metadata
    requiredMetadata.forEach((k) => {
      if (!(k in s)) local.push(`missing metadata field '${k}'`);
      else metaCounts[k] += 1;
    });

    if ('requiredTools' in s && !Array.isArray(s.requiredTools)) local.push('requiredTools must be an array');

    if ('difficulty' in s) {
      if (typeof s.difficulty !== 'number' || s.difficulty < 1 || s.difficulty > 5) local.push('difficulty must be number 1-5');
    }

    if (local.length) scenarioErrors[ctx] = local;
  });

  const total = scenarios.length;
  const failedCount = Object.keys(scenarioErrors).length;
  const passed = total - failedCount;

  const metadataCoverage = {};
  requiredMetadata.forEach(k => {
    metadataCoverage[k] = { count: metaCounts[k], percent: Math.round((metaCounts[k] / total) * 100) };
  });

  const report = {
    timestamp: new Date().toISOString(),
    totalScenarios: total,
    passedScenarios: passed,
    failedScenarios: failedCount,
    categoriesKnown: categories.slice(),
    metadataCoverage,
    failures: scenarioErrors
  };

  // write report
  const reportDir = path.join(__dirname, '..', 'reports');
  try {
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'scenario-validation-report.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log('Wrote report to', path.join(reportDir, 'scenario-validation-report.json'));
  } catch (err) {
    console.error('Failed to write report:', err.message);
  }

  if (failedCount) {
    console.error('Validation failed for', failedCount, 'scenarios. See report for details.');
    process.exit(1);
  }

  console.log('All', total, 'scenarios validated OK. Categories known:', categories.length);
}

if (require.main === module) validate();

module.exports = { validate };
