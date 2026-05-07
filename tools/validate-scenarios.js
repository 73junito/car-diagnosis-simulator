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
  const errors = [];

  scenarios.forEach((s, idx) => {
    const ctx = `scenario[id=${s && s.id}]`;
    if (!s) { errors.push(`${ctx}: empty`); return; }
    if (s.id === undefined || s.id === null) errors.push(`${ctx}: missing id`);
    if (!s.symptoms || typeof s.symptoms !== 'string') errors.push(`${ctx}: missing or invalid symptoms`);
    if (!s.fault && !s.faults) errors.push(`${ctx}: missing fault (expected 'fault' or 'faults')`);
    if ((!s.tests || typeof s.tests !== 'object') && !Array.isArray(s.steps)) errors.push(`${ctx}: missing tests object or procedural 'steps'`);
    if (!s.symptomCategory) errors.push(`${ctx}: missing symptomCategory`);
    else if (!categories.includes(s.symptomCategory)) errors.push(`${ctx}: unknown symptomCategory '${s.symptomCategory}'`);

    // metadata
    requiredMetadata.forEach((k) => {
      if (!(k in s)) errors.push(`${ctx}: missing metadata field '${k}'`);
    });

    if ('requiredTools' in s && !Array.isArray(s.requiredTools)) errors.push(`${ctx}: requiredTools must be an array`);

    if ('difficulty' in s) {
      if (typeof s.difficulty !== 'number' || s.difficulty < 1 || s.difficulty > 5) errors.push(`${ctx}: difficulty must be number 1-5`);
    }
  });

  if (errors.length) {
    console.error('Validation failed with', errors.length, 'errors:');
    errors.forEach(e => console.error(' -', e));
    process.exit(1);
  }

  console.log('All', scenarios.length, 'scenarios validated OK. Categories known:', categories.length);
}

if (require.main === module) validate();

module.exports = { validate };
