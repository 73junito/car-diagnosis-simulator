const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));

function expectedProjection() {
  const labs = read('data/lmf/lab-registry.json');
  const adapters = read('data/lmf/engineering-model-adapters.json');
  const tools = read('data/lmf/diagnostic-tools.json');
  const measurements = read('data/lmf/measurement-contract.json');
  const faults = read('data/lmf/fault-taxonomy.json');
  const model = read('data/circuit-templates/12v-can-lin-network.json');

  const lab = labs.labs.find((entry) => entry.labId === 'network-lab');
  if (!lab) throw new Error('LMF network-lab registration is missing.');
  const adapter = adapters.adapters.find((entry) => entry.adapterId === lab.engineeringAdapterId);
  if (!adapter) throw new Error('Network Lab engineering adapter is missing.');

  const selectedTools = lab.toolIds.map((id) => {
    const tool = tools.tools.find((entry) => entry.toolId === id);
    if (!tool) throw new Error('Unknown Network Lab tool: ' + id);
    return tool;
  });

  const knownMeasurements = new Set(measurements.measurementTypes.map((entry) => entry.measurementType));
  const measurementTypes = [...new Set(selectedTools.flatMap((tool) => tool.measurementTypes))].sort();
  for (const type of measurementTypes) {
    if (!knownMeasurements.has(type)) throw new Error('Unknown measurement type: ' + type);
  }

  const knownCommunicationClasses = new Set(
    faults.categories.filter((entry) => entry.domain === 'communications').map((entry) => entry.faultClassId)
  );
  const nodeOfflineFaultIds = new Set(['FAULT_OPEN_MODULE_POWER', 'FAULT_OPEN_MODULE_GROUND']);
  const faultClassIds = [...new Set(model.faultCatalog.map((fault) => {
    let faultClassId;
    if (nodeOfflineFaultIds.has(fault.id)) faultClassId = 'communications.node-offline';
    else if (fault.type === 'open_circuit') faultClassId = 'communications.open-bus';
    else if (['short_to_ground','short_to_power','short_between_lines'].includes(fault.type)) faultClassId = 'communications.short-bus';
    else throw new Error('Unmapped Network Lab fault: ' + fault.id + ' (' + fault.type + ')');
    if (!knownCommunicationClasses.has(faultClassId)) throw new Error('Unknown communications fault class: ' + faultClassId);
    return faultClassId;
  }))].sort();

  return { lab, adapter, measurementTypes, faultClassIds };
}

function validateNetworkLabRuntime() {
  const runtime = read('data/architecture/network-lab-lmf-runtime.json');
  const expected = expectedProjection();

  if (runtime.labId !== expected.lab.labId) throw new Error('Runtime labId drift.');
  if (runtime.route !== expected.lab.route) throw new Error('Runtime route drift.');
  if (runtime.engineeringAdapterId !== expected.lab.engineeringAdapterId) throw new Error('Runtime adapter drift.');
  if (JSON.stringify(runtime.toolIds) !== JSON.stringify(expected.lab.toolIds)) throw new Error('Runtime toolIds drift.');
  if (runtime.directPracticeAllowed !== expected.lab.directPracticeAllowed) throw new Error('Runtime practice flag drift.');
  if (runtime.modelRef !== '/data/circuit-templates/12v-can-lin-network.json') throw new Error('Network Lab modelRef drift.');
  if (expected.adapter.status !== 'existing-model-family') throw new Error('Network Lab adapter is not production-existing.');
  if (expected.adapter.family !== 'communications') throw new Error('Network Lab adapter family drift.');
  if (JSON.stringify([...runtime.measurementTypes].sort()) !== JSON.stringify(expected.measurementTypes)) throw new Error('Runtime measurement types drift.');
  if (JSON.stringify([...runtime.faultClassIds].sort()) !== JSON.stringify(expected.faultClassIds)) throw new Error('Runtime modeled communications fault classes drift.');
  if (runtime.assessmentEligibilityAuthority !== 'external-governance-only') throw new Error('Runtime may not own assessment eligibility.');
  if (runtime.publicationAuthority !== 'external-human-governance-only') throw new Error('Runtime may not own publication approval.');
  return runtime;
}

if (require.main === module) {
  validateNetworkLabRuntime();
  console.log('Network Lab LMF runtime projection: PASS');
}

module.exports = { validateNetworkLabRuntime, expectedProjection };
