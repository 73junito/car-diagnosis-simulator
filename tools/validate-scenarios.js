const fs = require('fs');
const vm = require('vm');
const path = require('path');
const Ajv = require('ajv');

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

  // duplicate ID / title detection
  const idCounts = {};
  const titleCounts = {};
  scenarios.forEach(s => {
    if (!s) return;
    const id = String(s.id);
    idCounts[id] = (idCounts[id] || 0) + 1;
    const title = (s.symptoms || '').trim();
    if (title) titleCounts[title] = (titleCounts[title] || 0) + 1;
  });

  const requiredMetadata = ['vehicleType','diagnosticMode','requiredTools','safetyLevel'];
  const scenarioErrors = {};
  const metaCounts = {};
  requiredMetadata.forEach(k => metaCounts[k] = 0);

  // AJV schema validation
  const schemaPath = path.join(__dirname, '..', 'schemas', 'scenario.schema.json');
  let ajvErrorsByScenario = {};
  try {
    const schemaRaw = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaRaw);
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validateSchema = ajv.compile(schema);
    scenarios.forEach((s) => {
      const valid = validateSchema(s);
      if (!valid) {
        ajvErrorsByScenario[`scenario[id=${s && s.id}]`] = (validateSchema.errors || []).map(e => ({ message: e.message, instancePath: e.instancePath, keyword: e.keyword, params: e.params }));
      }
    });
  } catch (err) {
    console.error('AJV schema load/compile error:', err.message);
    // continue with custom checks; report will note AJV failure
    ajvErrorsByScenario = { schemaLoadError: [err.message] };
  }

  scenarios.forEach((s, idx) => {
    const ctx = `scenario[id=${s && s.id}]`;
    const local = [];
    if (!s) { local.push('empty'); scenarioErrors[ctx] = local; return; }
    if (s.id === undefined || s.id === null) local.push('missing id');
    // duplicate id
    if (idCounts[String(s.id)] > 1) local.push('duplicate id');
    if (!s.symptoms || typeof s.symptoms !== 'string') local.push('missing or invalid symptoms');
    // duplicate title/symptoms
    if (s.symptoms && titleCounts[s.symptoms.trim()] > 1) local.push('duplicate symptoms/title');
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

    // symptom coverage: ensure descriptive symptom text (>=20 chars)
    if (s.symptoms && s.symptoms.trim().length < 20) local.push('insufficient symptom description (<20 chars)');

    if (local.length) scenarioErrors[ctx] = local;
  });

  // Merge AJV errors into failures
  const ajvFailures = {};
  Object.keys(ajvErrorsByScenario).forEach(k => {
    // map AJV entries into readable strings
    const list = ajvErrorsByScenario[k];
    if (!list) return;
    ajvFailures[k] = list.map(err => {
      if (typeof err === 'string') return err;
      return `${err.instancePath || ''} ${err.keyword || ''}: ${err.message || JSON.stringify(err.params)}`.trim();
    });
    // merge with existing scenarioErrors
    if (scenarioErrors[k]) scenarioErrors[k] = scenarioErrors[k].concat(ajvFailures[k]);
    else scenarioErrors[k] = ajvFailures[k];
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
    failures: scenarioErrors,
    schemaErrors: ajvErrorsByScenario
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
