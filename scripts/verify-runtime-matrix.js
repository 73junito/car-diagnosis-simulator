const fs = require('fs');
const path = require('path');
const { verifyLmfRuntimeCoverage } = require('./verify-lmf-runtime-coverage');
const { verifyObservabilityContract } = require('./verify-observability-contract');
const { verifyArchitectureSchemas } = require('./verify-architecture-schemas');

const ROOT = path.resolve(__dirname, '..');

function readText(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, '');
}

function readJson(relative) {
  return JSON.parse(readText(relative));
}

function fail(message) {
  throw new Error(message);
}

function normalizeNodeVersion(value) {
  return String(value).trim().replace(/^v/, '');
}

function versionAtLeast(actual, minimum) {
  const a = normalizeNodeVersion(actual).split('.').map(Number);
  const b = normalizeNodeVersion(minimum).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return true;
}

function explicitNodeVersions(workflowText) {
  const versions = [];
  for (const match of workflowText.matchAll(/node-version:\s*['"]?(\d+)['"]?/g)) {
    versions.push(Number(match[1]));
  }
  return versions;
}

function assertSurface(surface) {
  const config = readJson(surface.wranglerConfig);

  if (config.name !== surface.workerName) {
    fail(`${surface.id}: Worker name drift (${config.name}).`);
  }
  if ((config.main || null) !== surface.workerEntry) {
    fail(`${surface.id}: Worker entry drift.`);
  }
  if (!config.assets || config.assets.directory !== surface.assetDirectory) {
    fail(`${surface.id}: asset directory drift.`);
  }
  if (config.compatibility_date !== surface.compatibilityDate) {
    fail(`${surface.id}: Cloudflare compatibility date drift.`);
  }

  const routeHosts = (config.routes || []).map((route) =>
    typeof route === 'string' ? route : route.pattern
  );
  if (surface.routingAuthority === 'wrangler-config' && !routeHosts.includes(surface.hostname)) {
    fail(`${surface.id}: expected production hostname ${surface.hostname} is not configured.`);
  }
  if (surface.routingAuthority === 'cloudflare-external' && routeHosts.length) {
    fail(`${surface.id}: routing is declared externally but wrangler routes are also present.`);
  }
  if (!['wrangler-config', 'cloudflare-external'].includes(surface.routingAuthority)) {
    fail(`${surface.id}: unknown routing authority.`);
  }

  return config;
}

function verifyRuntimeMatrix() {
  const schemaValidation = verifyArchitectureSchemas();
  const matrix = readJson('data/architecture/runtime-matrix.json');
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');

  if (matrix.status !== 'runtime-stabilization-contract') {
    fail('Runtime matrix is not marked as the stabilization contract.');
  }

  const engineRange = matrix.canonicalBuildRuntime.packageEngineRange;
  if (pkg.engines?.node !== engineRange) {
    fail(`package.json Node engine drift: expected ${engineRange}, found ${pkg.engines?.node || 'missing'}.`);
  }

  for (const scriptName of [
    'cloudflare:app:deploy',
    'cloudflare:app:preview',
    'cloudflare:exam:deploy',
    'cloudflare:exam:preview'
  ]) {
    const command = pkg.scripts?.[scriptName];
    if (!command || !command.includes('--env=""')) {
      fail(`${scriptName} must explicitly target the top-level Cloudflare environment with --env="".`);
    }
  }

  const lockRoot = lock.packages && lock.packages[''];
  if (!lockRoot || lockRoot.engines?.node !== engineRange) {
    fail('package-lock.json root Node engine does not match the runtime contract.');
  }

  const canonicalMajor = matrix.canonicalBuildRuntime.major;
  const developerPin = matrix.canonicalBuildRuntime.developerPin;
  if (readText('.nvmrc').trim() !== developerPin) {
    fail('.nvmrc does not match the reviewed Node developer pin.');
  }
  if (readText('.node-version').trim() !== developerPin) {
    fail('.node-version does not match the reviewed Node developer pin.');
  }

  const current = normalizeNodeVersion(process.version);
  const currentMajor = Number(current.split('.')[0]);
  const allowedMajors = matrix.compatibilityValidation.nodeMajors;
  if (!allowedMajors.includes(currentMajor)) {
    fail(`Current Node major ${currentMajor} is outside supported majors ${allowedMajors.join(', ')}.`);
  }
  if (
    currentMajor === canonicalMajor &&
    !versionAtLeast(current, matrix.canonicalBuildRuntime.minimumVersion)
  ) {
    fail(`Canonical Node runtime must be >= ${matrix.canonicalBuildRuntime.minimumVersion}.`);
  }

  const ci = readText('.github/workflows/ci.yml');
  const ciMatrixMatch = ci.match(/node-version:\s*\[([^\]]+)\]/);
  if (!ciMatrixMatch) fail('CI Node compatibility matrix is missing.');
  const ciMajors = [...ciMatrixMatch[1].matchAll(/['"]?(\d+)['"]?/g)].map((m) => Number(m[1]));
  if (JSON.stringify(ciMajors) !== JSON.stringify(allowedMajors)) {
    fail(`CI Node matrix drift: expected ${allowedMajors.join(', ')}, found ${ciMajors.join(', ')}.`);
  }

  const workflowDir = path.join(ROOT, '.github', 'workflows');
  for (const name of fs.readdirSync(workflowDir).filter((entry) => /\.ya?ml$/i.test(entry))) {
    const versions = explicitNodeVersions(fs.readFileSync(path.join(workflowDir, name), 'utf8'));
    for (const major of versions) {
      if (!allowedMajors.includes(major)) {
        fail(`${name}: unsupported explicit Node major ${major}.`);
      }
    }
  }

  const release = readText('.github/workflows/release.yml');
  const releaseVersions = explicitNodeVersions(release);
  if (!releaseVersions.length) fail('Release workflow declares no Node runtime.');
  for (const major of releaseVersions) {
    if (major !== matrix.compatibilityValidation.releaseAuthorityMajor) {
      fail(`Release workflow must use Node ${matrix.compatibilityValidation.releaseAuthorityMajor}, found ${major}.`);
    }
  }
  const releaseSpecs = [...release.matchAll(/node-version:\s*['"]?([0-9]+(?:\.[0-9]+(?:\.[0-9]+)?)?)['"]?/g)]
    .map((match) => match[1]);
  if (!releaseSpecs.length) fail('Release workflow declares no concrete Node version.');
  for (const version of releaseSpecs) {
    if (version !== matrix.compatibilityValidation.releaseAuthorityVersion) {
      fail(`Release workflow must pin Node ${matrix.compatibilityValidation.releaseAuthorityVersion}, found ${version}.`);
    }
  }

  const configs = new Map();
  for (const surface of matrix.surfaces) {
    configs.set(surface.id, assertSurface(surface));
  }

  const app = configs.get('app');
  if (!app) fail('App runtime surface is missing.');

  if (app.vars?.TORQUEMIND_ORCHESTRATION_PERSISTENCE !== matrix.persistence.productionOrchestrationPersistence) {
    fail('Production orchestration persistence drift.');
  }
  if (app.env?.staging?.vars?.TORQUEMIND_ORCHESTRATION_PERSISTENCE !== matrix.persistence.stagingOrchestrationPersistence) {
    fail('Staging orchestration persistence drift.');
  }
  if (app.previews?.vars?.TORQUEMIND_ORCHESTRATION_PERSISTENCE !== matrix.persistence.previewOrchestrationPersistence) {
    fail('Preview orchestration persistence drift.');
  }

  const rateLimiter = (app.durable_objects?.bindings || []).find(
    (binding) => binding.name === 'TORQUEMIND_RATE_LIMITER'
  );
  if (!rateLimiter) fail('App Durable Object rate limiter binding is missing.');

  const exportedClass = app.exports?.[rateLimiter.class_name];
  if (!exportedClass || exportedClass.type !== 'durable-object') {
    fail('Rate limiter Durable Object export is missing or invalid.');
  }
  if (exportedClass.storage !== matrix.persistence.durableObjectStorage) {
    fail('Durable Object storage runtime drift.');
  }

  if (matrix.productionExecutionRuntime.provider !== 'cloudflare-workers') {
    fail('Production execution provider drift.');
  }
  if (matrix.productionExecutionRuntime.nodeServer !== false) {
    fail('Runtime contract must not classify production as a Node server.');
  }

  const observability = verifyObservabilityContract();
  if (matrix.observability?.primaryBackend !== observability.primaryBackend) {
    fail('Primary observability backend drift from runtime matrix.');
  }
  if (matrix.observability?.plannedExternalOtlpBackend !== observability.externalOtlpProvider) {
    fail('Planned external OTLP backend drift from runtime matrix.');
  }
  if (matrix.observability?.externalOtlpStatus !== observability.externalOtlpStatus) {
    fail('External OTLP status drift from runtime matrix.');
  }

  const lmf = verifyLmfRuntimeCoverage();
  if (
    lmf.existingLabCount !== matrix.lmf.existingProductionLabCount ||
    lmf.plannedLabCount !== matrix.lmf.plannedUnprojectedLabCount
  ) {
    fail('LMF runtime counts drift from the runtime matrix.');
  }

  return {
    architectureSchemaFiles: schemaValidation.validatedFileCount,
    currentNode: current,
    canonicalNodeMajor: canonicalMajor,
    compatibilityNodeMajors: allowedMajors,
    releaseAuthorityMajor: matrix.compatibilityValidation.releaseAuthorityMajor,
    releaseAuthorityVersion: matrix.compatibilityValidation.releaseAuthorityVersion,
    surfaces: matrix.surfaces.map((surface) => ({
      id: surface.id,
      compatibilityDate: surface.compatibilityDate
    })),
    observabilityBackend: observability.primaryBackend,
    externalOtlpStatus: observability.externalOtlpStatus,
    lmfExistingLabs: lmf.existingLabCount,
    lmfPlannedLabs: lmf.plannedLabCount
  };
}

if (require.main === module) {
  const result = verifyRuntimeMatrix();
  console.log(
    `Runtime matrix: PASS (Node ${result.canonicalNodeMajor} canonical; Node ${result.compatibilityNodeMajors.join('/')} supported; ${result.surfaces.length} Cloudflare surfaces; observability=${result.observabilityBackend}; LMF ${result.lmfExistingLabs} existing / ${result.lmfPlannedLabs} planned)`
  );
}

module.exports = { verifyRuntimeMatrix };
