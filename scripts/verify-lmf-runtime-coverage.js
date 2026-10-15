const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARCH_DIR = path.join(ROOT, 'data', 'architecture');

const read = (relative) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, ''));

const REQUIRED_SOURCE_CONTRACTS = [
  '/data/lmf/lab-registry.json',
  '/data/lmf/engineering-model-adapters.json',
  '/data/lmf/diagnostic-tools.json',
  '/data/lmf/measurement-contract.json',
  '/data/lmf/fault-taxonomy.json'
];

const FORBIDDEN_AUTHORITY_FIELDS = [
  'assessmentEligible',
  'publicationApproved',
  'score',
  'points',
  'correctAnswer',
  'diagnosticConclusion'
];

function runtimeFiles() {
  return fs.readdirSync(ARCH_DIR)
    .filter((name) => name.endsWith('-lmf-runtime.json'))
    .sort();
}

function publicRefExists(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('/')) return false;
  return fs.existsSync(path.join(ROOT, ref.slice(1)));
}

function exactSet(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function verifyLmfRuntimeCoverage() {
  const registry = read('data/lmf/lab-registry.json');
  const adapters = read('data/lmf/engineering-model-adapters.json');
  const tools = read('data/lmf/diagnostic-tools.json');
  const measurementContract = read('data/lmf/measurement-contract.json');
  const faultTaxonomy = read('data/lmf/fault-taxonomy.json');

  const existingLabs = registry.labs.filter((lab) => lab.lifecycle === 'existing');
  const plannedLabs = registry.labs.filter((lab) => lab.lifecycle !== 'existing');
  const adapterById = new Map(adapters.adapters.map((adapter) => [adapter.adapterId, adapter]));
  const toolById = new Map(tools.tools.map((tool) => [tool.toolId, tool]));
  const knownMeasurements = new Set(
    measurementContract.measurementTypes.map((entry) => entry.measurementType)
  );
  const legacyFaultMap = new Map(
    faultTaxonomy.legacyMappings.map((entry) => [entry.legacyType, entry.faultClassId])
  );
  const knownFaultClasses = new Set(
    faultTaxonomy.categories.map((entry) => entry.faultClassId)
  );
  const faultDomainByClass = new Map(
    faultTaxonomy.categories.map((entry) => [entry.faultClassId, entry.domain])
  );

  const files = runtimeFiles();
  const runtimes = files.map((name) => ({
    file: name,
    runtime: read(path.posix.join('data/architecture', name))
  }));

  if (runtimes.length !== existingLabs.length) {
    throw new Error(
      `LMF runtime projection count drift: expected ${existingLabs.length}, found ${runtimes.length}.`
    );
  }

  const runtimeByLabId = new Map();
  for (const { file, runtime } of runtimes) {
    if (!runtime.labId) throw new Error(`${file}: missing labId.`);
    if (runtimeByLabId.has(runtime.labId)) {
      throw new Error(`Duplicate LMF runtime projection for ${runtime.labId}.`);
    }
    runtimeByLabId.set(runtime.labId, { file, runtime });
  }

  for (const planned of plannedLabs) {
    if (runtimeByLabId.has(planned.labId)) {
      throw new Error(`Planned lab ${planned.labId} must not have a production runtime projection.`);
    }
    if (planned.directPracticeAllowed !== false) {
      throw new Error(`Planned lab ${planned.labId} must remain directPracticeAllowed=false.`);
    }
  }

  for (const lab of existingLabs) {
    const record = runtimeByLabId.get(lab.labId);
    if (!record) throw new Error(`Missing LMF runtime projection for existing lab ${lab.labId}.`);
    const { file, runtime } = record;

    if (runtime.route !== lab.route) throw new Error(`${file}: route drift.`);
    if (runtime.engineeringAdapterId !== lab.engineeringAdapterId) {
      throw new Error(`${file}: engineering adapter drift.`);
    }
    if (!exactSet(runtime.toolIds || [], lab.toolIds || [])) {
      throw new Error(`${file}: toolIds drift.`);
    }
    if (runtime.directPracticeAllowed !== lab.directPracticeAllowed) {
      throw new Error(`${file}: direct-practice drift.`);
    }

    const adapter = adapterById.get(runtime.engineeringAdapterId);
    if (!adapter) throw new Error(`${file}: unknown engineering adapter.`);
    if (adapter.status !== 'existing-model-family') {
      throw new Error(`${file}: adapter is not an existing model family.`);
    }

    const selectedTools = runtime.toolIds.map((toolId) => {
      const tool = toolById.get(toolId);
      if (!tool) throw new Error(`${file}: unknown tool ${toolId}.`);
      if (tool.status !== 'registered') throw new Error(`${file}: unregistered tool ${toolId}.`);
      if (tool.engineeringAuthority !== false || tool.assessmentAuthority !== false) {
        throw new Error(`${file}: diagnostic tool authority boundary drift for ${toolId}.`);
      }
      return tool;
    });

    const expectedMeasurements = [
      ...new Set(selectedTools.flatMap((tool) => tool.measurementTypes))
    ];
    for (const type of expectedMeasurements) {
      if (!knownMeasurements.has(type)) {
        throw new Error(`${file}: tool declares unknown measurement type ${type}.`);
      }
    }
    if (!exactSet(runtime.measurementTypes || [], expectedMeasurements)) {
      throw new Error(`${file}: measurement type projection drift.`);
    }

    if (!publicRefExists(runtime.modelRef)) {
      throw new Error(`${file}: modelRef is missing or does not exist.`);
    }
    if (runtime.engineeringProfileRef && !publicRefExists(runtime.engineeringProfileRef)) {
      throw new Error(`${file}: engineeringProfileRef does not exist.`);
    }

    const model = read(runtime.modelRef.slice(1));
    const runtimeFaultClasses = new Set(runtime.faultClassIds || []);
    for (const faultClassId of runtimeFaultClasses) {
      if (!knownFaultClasses.has(faultClassId)) {
        throw new Error(`${file}: unknown projected fault class ${faultClassId}.`);
      }
    }

    if (adapter.family === 'communications') {
      const communicationFaultClasses = faultTaxonomy.categories
        .filter((entry) => entry.domain === 'communications')
        .map((entry) => entry.faultClassId);
      if (!exactSet(runtimeFaultClasses, communicationFaultClasses)) {
        throw new Error(`${file}: communications fault taxonomy projection drift.`);
      }
    } else {
      const expectedFaultClasses = [
        ...new Set((model.faultCatalog || []).map((fault) => {
          const mapped = legacyFaultMap.get(fault.type);
          if (!mapped) {
            throw new Error(`${file}: unmapped concrete fault type ${fault.type}.`);
          }
          return mapped;
        }))
      ];
      for (const faultClassId of runtimeFaultClasses) {
        if (faultDomainByClass.get(faultClassId) !== 'electrical') {
          throw new Error(`${file}: non-electrical fault class ${faultClassId} is not valid for this adapter family.`);
        }
      }
      for (const faultClassId of expectedFaultClasses) {
        if (!runtimeFaultClasses.has(faultClassId)) {
          throw new Error(`${file}: concrete model fault class ${faultClassId} is not covered by the runtime projection.`);
        }
      }
    }

    if (!exactSet(runtime.sourceContracts || [], REQUIRED_SOURCE_CONTRACTS)) {
      throw new Error(`${file}: source contract set drift.`);
    }
    if (runtime.assessmentEligibilityAuthority !== 'external-governance-only') {
      throw new Error(`${file}: assessment authority boundary drift.`);
    }
    if (runtime.publicationAuthority !== 'external-human-governance-only') {
      throw new Error(`${file}: publication authority boundary drift.`);
    }
    for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(runtime, field)) {
        throw new Error(`${file}: forbidden authority field ${field}.`);
      }
    }
  }

  return {
    existingLabCount: existingLabs.length,
    plannedLabCount: plannedLabs.length,
    runtimeProjectionCount: runtimes.length,
    runtimeFiles: files
  };
}

if (require.main === module) {
  const result = verifyLmfRuntimeCoverage();
  console.log(
    `LMF runtime coverage audit: PASS (${result.runtimeProjectionCount}/${result.existingLabCount} existing labs projected; ${result.plannedLabCount} planned labs remain unprojected)`
  );
}

module.exports = { verifyLmfRuntimeCoverage };
