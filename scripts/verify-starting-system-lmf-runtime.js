const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));

function buildExpectedProjection() {
  const labs = read('data/lmf/lab-registry.json');
  const adapters = read('data/lmf/engineering-model-adapters.json');
  const tools = read('data/lmf/diagnostic-tools.json');
  const measurements = read('data/lmf/measurement-contract.json');
  const faults = read('data/lmf/fault-taxonomy.json');
  const model = read('data/circuit-templates/12v-starting-system.json');

  const lab = labs.labs.find((entry) => entry.labId === 'starting-system-lab');
  if (!lab) throw new Error('LMF starting-system-lab registration is missing.');
  const adapter = adapters.adapters.find((entry) => entry.adapterId === lab.engineeringAdapterId);
  if (!adapter) throw new Error('Starting System engineering adapter is missing.');

  const selectedTools = lab.toolIds.map((id) => {
    const tool = tools.tools.find((entry) => entry.toolId === id);
    if (!tool) throw new Error('Unknown Starting System tool: ' + id);
    return tool;
  });
  const knownMeasurements = new Set(measurements.measurementTypes.map((entry) => entry.measurementType));
  const measurementTypes = [...new Set(selectedTools.flatMap((tool) => tool.measurementTypes))].sort();
  for (const type of measurementTypes) {
    if (!knownMeasurements.has(type)) throw new Error('Unknown measurement type: ' + type);
  }

  const legacyMap = new Map(faults.legacyMappings.map((entry) => [entry.legacyType, entry.faultClassId]));
  const faultClassIds = [...new Set(model.faultCatalog.map((fault) => {
    const mapped = legacyMap.get(fault.type);
    if (!mapped) throw new Error('Unmapped Starting System fault type: ' + fault.type);
    return mapped;
  }))].sort();

  return { lab, adapter, measurementTypes, faultClassIds };
}

function validateStartingSystemRuntime() {
  const runtime = read('data/architecture/starting-system-lmf-runtime.json');
  const expected = buildExpectedProjection();

  if (runtime.labId !== expected.lab.labId) throw new Error('Runtime labId drift.');
  if (runtime.route !== expected.lab.route) throw new Error('Runtime route drift.');
  if (runtime.engineeringAdapterId !== expected.lab.engineeringAdapterId) throw new Error('Runtime adapter drift.');
  if (JSON.stringify(runtime.toolIds) !== JSON.stringify(expected.lab.toolIds)) throw new Error('Runtime toolIds drift.');
  if (runtime.directPracticeAllowed !== expected.lab.directPracticeAllowed) throw new Error('Runtime practice flag drift.');
  if (runtime.modelRef !== '/data/circuit-templates/12v-starting-system.json') throw new Error('Starting System modelRef drift.');
  if (expected.adapter.status !== 'existing-model-family') throw new Error('Starting System adapter is not production-existing.');
  if (JSON.stringify([...runtime.measurementTypes].sort()) !== JSON.stringify(expected.measurementTypes)) throw new Error('Runtime measurement types drift.');
  if (JSON.stringify([...runtime.faultClassIds].sort()) !== JSON.stringify(expected.faultClassIds)) throw new Error('Runtime modeled fault classes drift.');
  if (runtime.assessmentEligibilityAuthority !== 'external-governance-only') throw new Error('Runtime may not own assessment eligibility.');
  if (runtime.publicationAuthority !== 'external-human-governance-only') throw new Error('Runtime may not own publication approval.');
  return runtime;
}

if (require.main === module) {
  validateStartingSystemRuntime();
  console.log('Starting System LMF runtime projection: PASS');
}

module.exports = { validateStartingSystemRuntime, buildExpectedProjection };
