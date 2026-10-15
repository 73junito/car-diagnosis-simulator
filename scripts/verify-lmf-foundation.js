const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LMF_DIR = path.join(ROOT, 'data', 'lmf');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(LMF_DIR, name), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    assert(typeof value === 'string' && value.length > 0, `${label} contains an empty/non-string ID`);
    assert(!seen.has(value), `Duplicate ${label}: ${value}`);
    seen.add(value);
  }
  return seen;
}

function collectLegacyCircuitFaultTypes() {
  const dir = path.join(ROOT, 'data', 'circuit-templates');
  const types = new Set();
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const fault of doc.faultCatalog || []) {
      if (fault && typeof fault.type === 'string') types.add(fault.type);
    }
  }
  return types;
}

function collectScenarioKeys() {
  const source = fs.readFileSync(path.join(ROOT, 'data', 'scenarios.js'), 'utf8');
  return new Set([...source.matchAll(/scenario_key:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]));
}

function validateFoundation() {
  const labs = readJson('lab-registry.json');
  const mappings = readJson('scenario-lab-mappings.json');
  const adapters = readJson('engineering-model-adapters.json');
  const tools = readJson('diagnostic-tools.json');
  const measurements = readJson('measurement-contract.json');
  const faults = readJson('fault-taxonomy.json');

  for (const [name, doc] of Object.entries({ labs, mappings, adapters, tools, measurements, faults })) {
    assert(doc.schemaVersion === '1.0.0', `${name} schemaVersion must be 1.0.0`);
  }

  const domainIds = unique(labs.domains.map((d) => d.id), 'lab domain ID');
  const labIds = unique(labs.labs.map((lab) => lab.labId), 'lab ID');
  const adapterIds = unique(adapters.adapters.map((a) => a.adapterId), 'engineering adapter ID');
  const toolIds = unique(tools.tools.map((tool) => tool.toolId), 'diagnostic tool ID');
  const measurementTypes = unique(measurements.measurementTypes.map((m) => m.measurementType), 'measurement type');
  const faultClassIds = unique(faults.categories.map((fault) => fault.faultClassId), 'fault class ID');

  assert(labs.labs.length === 17, `LMF-1 must register exactly 17 current/planned workspaces; found ${labs.labs.length}`);

  const expectedExisting = new Set([
    'circuit-lab',
    'starting-system-lab',
    'relay-load-lab',
    'sensor-lab',
    'actuator-lab',
    'network-lab',
    'multivoltage-lab'
  ]);
  const actualExisting = new Set(labs.labs.filter((lab) => lab.lifecycle === 'existing').map((lab) => lab.labId));
  assert(actualExisting.size === expectedExisting.size, 'Existing lab count changed unexpectedly');
  for (const id of expectedExisting) assert(actualExisting.has(id), `Missing existing lab: ${id}`);

  for (const lab of labs.labs) {
    assert(domainIds.has(lab.domainId), `${lab.labId} references unknown domain ${lab.domainId}`);
    assert(adapterIds.has(lab.engineeringAdapterId), `${lab.labId} references unknown adapter ${lab.engineeringAdapterId}`);
    assert(Array.isArray(lab.toolIds), `${lab.labId} toolIds must be an array`);
    for (const toolId of lab.toolIds) assert(toolIds.has(toolId), `${lab.labId} references unknown tool ${toolId}`);
    if (lab.lifecycle === 'existing') {
      assert(typeof lab.route === 'string' && lab.route.startsWith('/dashboard/student/'), `${lab.labId} existing route is invalid`);
      assert(lab.directPracticeAllowed === true, `${lab.labId} existing direct practice must remain allowed`);
    } else {
      assert(lab.lifecycle === 'planned', `${lab.labId} lifecycle must be existing or planned`);
      assert(lab.route === null, `${lab.labId} planned route must remain null until implementation`);
      assert(lab.directPracticeAllowed === false, `${lab.labId} planned direct practice must remain disabled`);
    }
  }

  assert(mappings.rules.scenarioProvidesInstructionalContextOnly === true, 'LMF-2 must keep scenarios instructional-context-only');
  assert(mappings.rules.mappingMayDefineEngineeringBehavior === false, 'LMF-2 must not define engineering behavior');
  assert(mappings.rules.mappingMayGrantAssessmentEligibility === false, 'LMF-2 must not grant assessment eligibility');
  assert(mappings.rules.mappingMayGrantPublication === false, 'LMF-2 must not grant publication');
  unique(mappings.mappings.map((m) => m.mappingId), 'scenario/lab mapping ID');
  const canonicalScenarioKeys = collectScenarioKeys();
  const labById = new Map(labs.labs.map((lab) => [lab.labId, lab]));
  for (const mapping of mappings.mappings) {
    assert(labIds.has(mapping.labId), `${mapping.mappingId} references unknown lab ${mapping.labId}`);
    assert(mapping.status === 'active' || mapping.status === 'planned', `${mapping.mappingId} has invalid status`);
    if (mapping.status === 'active') {
      assert(labById.get(mapping.labId).lifecycle === 'existing', `${mapping.mappingId} cannot be active for a planned lab`);
    }
    assert(mapping.selector && typeof mapping.selector === 'object', `${mapping.mappingId} must use an explicit selector object`);
    assert(['scenario-key', 'curriculum-scenario-id'].includes(mapping.selector.kind), `${mapping.mappingId} has unsupported selector kind`);
    assert(typeof mapping.selector.value === 'string' && mapping.selector.value.length > 0, `${mapping.mappingId} selector value is required`);
    if (mapping.selector.kind === 'scenario-key') {
      assert(canonicalScenarioKeys.has(mapping.selector.value), `${mapping.mappingId} references unknown scenario_key ${mapping.selector.value}`);
    }
    assert(mapping.scenarioId === undefined, `${mapping.mappingId} must not use ambiguous scenarioId routing`);
    assert(mapping.symptomCategory === undefined, `${mapping.mappingId} must not route by symptomCategory`);
  }
  for (const unmapped of mappings.unmappedSelectors || []) {
    assert(unmapped.selector && unmapped.selector.kind === 'scenario-key', 'Unmapped selector must use scenario-key');
    assert(canonicalScenarioKeys.has(unmapped.selector.value), `Unmapped selector references unknown scenario_key ${unmapped.selector.value}`);
    assert(typeof unmapped.reason === 'string' && unmapped.reason.length > 20, `Unmapped selector ${unmapped.selector.value} requires a governance reason`);
    assert(!mappings.mappings.some((mapping) => mapping.selector.kind === 'scenario-key' && mapping.selector.value === unmapped.selector.value), `Scenario ${unmapped.selector.value} cannot be both mapped and fail-closed`);
  }

  assert(adapters.interface.requiredInputs.includes('modelRef'), 'LMF-3 adapter input must require modelRef');
  assert(adapters.interface.requiredInputs.includes('operatingStateId'), 'LMF-3 adapter input must require operatingStateId');
  for (const prohibited of ['correctAnswer', 'score', 'assessmentEligible', 'publicationApproved']) {
    assert(adapters.interface.prohibitedOutputs.includes(prohibited), `LMF-3 missing prohibited output ${prohibited}`);
  }

  for (const tool of tools.tools) {
    assert(tool.engineeringAuthority === false, `${tool.toolId} must not own engineering authority`);
    assert(tool.assessmentAuthority === false, `${tool.toolId} must not own assessment authority`);
    for (const type of tool.measurementTypes) {
      assert(measurementTypes.has(type), `${tool.toolId} references unknown measurement type ${type}`);
    }
  }

  assert(measurements.authorityRules.thresholdsBelongToEvidenceOrEngineeringModels === true, 'LMF-5 thresholds must remain external');
  assert(measurements.authorityRules.toolDoesNotDeterminePassFail === true, 'LMF-5 tools must not determine pass/fail');
  for (const key of ['correctAnswer', 'score', 'points', 'assessmentEligible', 'publicationApproved', 'diagnosticConclusion']) {
    assert(measurements.recordShape.prohibited.includes(key), `LMF-5 missing prohibited record field ${key}`);
  }

  const legacyMap = new Map(faults.legacyMappings.map((entry) => [entry.legacyType, entry.faultClassId]));
  for (const [legacyType, faultClassId] of legacyMap) {
    assert(faultClassIds.has(faultClassId), `Legacy fault type ${legacyType} maps to unknown class ${faultClassId}`);
  }
  for (const legacyType of collectLegacyCircuitFaultTypes()) {
    assert(legacyMap.has(legacyType), `LMF-6 does not map existing circuit fault type ${legacyType}`);
  }

  const serialized = JSON.stringify({ labs, mappings, adapters, tools, measurements, faults });
  for (const forbidden of [
    '"assessmentEligible":true',
    '"scoredAssessmentApproved":true',
    '"publicationApproved":true',
    '"humanApproved":true'
  ]) {
    assert(!serialized.includes(forbidden), `Authority leakage detected: ${forbidden}`);
  }

  return {
    labs: labs.labs.length,
    existingLabs: actualExisting.size,
    plannedLabs: labs.labs.length - actualExisting.size,
    adapters: adapters.adapters.length,
    tools: tools.tools.length,
    measurementTypes: measurements.measurementTypes.length,
    faultClasses: faults.categories.length,
    mappedLegacyFaultTypes: legacyMap.size,
    scenarioMappings: mappings.mappings.length
  };
}

if (require.main === module) {
  try {
    const result = validateFoundation();
    console.log('[PASS] AutoLearnPro LMF-1 through LMF-6 foundation');
    console.log(`Labs: ${result.labs} (${result.existingLabs} existing, ${result.plannedLabs} planned)`);
    console.log(`Engineering adapters: ${result.adapters}`);
    console.log(`Shared diagnostic tools: ${result.tools}`);
    console.log(`Measurement types: ${result.measurementTypes}`);
    console.log(`Fault classes: ${result.faultClasses}; legacy circuit fault types mapped: ${result.mappedLegacyFaultTypes}`);
    console.log(`Initial governed scenario-to-lab mappings: ${result.scenarioMappings}`);
    console.log('Authority boundary: engineering models remain authoritative; LMF mappings/tools/presentation cannot grant assessment or publication.');
  } catch (error) {
    console.error('[FAIL] AutoLearnPro LMF foundation');
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateFoundation, collectLegacyCircuitFaultTypes, collectScenarioKeys };
