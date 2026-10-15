const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, ''));
}

function fail(message) {
  throw new Error(message);
}

function verifySignal(signal, expected, kind, context) {
  if (!signal) fail(`${context}: ${kind} configuration missing.`);
  const prefix = kind === 'logs' ? 'logs' : 'traces';
  if (signal.enabled !== expected[`${prefix}Enabled`]) fail(`${context}: ${kind} enabled drift.`);
  if (signal.head_sampling_rate !== expected[`${prefix}SamplingRate`]) fail(`${context}: ${kind} sampling drift.`);
  if (signal.persist !== expected[`${prefix}Persist`]) fail(`${context}: ${kind} persistence drift.`);
  if (Object.prototype.hasOwnProperty.call(signal, 'destinations')) {
    fail(`${context}: external OTLP destinations must not activate before account-level destination verification.`);
  }
}

function verifyObservabilityContract() {
  const contract = readJson('data/architecture/observability-contract.json');

  if (contract.status !== 'active-native-observability') fail('Observability contract status drift.');
  if (contract.primaryBackend?.provider !== 'cloudflare-observability') fail('Primary observability backend drift.');
  if (contract.externalOtlp?.provider !== 'grafana-cloud') fail('Planned OTLP backend drift.');
  if (contract.externalOtlp?.status !== 'pending-account-destination') {
    fail('External OTLP export may only become active through a separately verified account-level destination change.');
  }
  if (contract.externalOtlp?.repositorySecretsAllowed !== false) {
    fail('Observability credentials must not be stored in the repository.');
  }

  for (const surface of contract.surfaces) {
    const config = readJson(surface.wranglerConfig);

    if (surface.executionType === 'static-assets-only') {
      if (config.main) fail(`${surface.id}: static-only surface unexpectedly has a Worker entry.`);
      if (config.observability) fail(`${surface.id}: static-only surface must not declare Worker observability.`);
      continue;
    }

    verifySignal(config.observability?.logs, surface.production, 'logs', `${surface.id} production`);
    verifySignal(config.observability?.traces, surface.production, 'traces', `${surface.id} production`);

    const staging = config.env?.staging?.observability;
    if (!staging) fail(`${surface.id}: staging observability missing.`);
    verifySignal(staging.logs, surface.staging, 'logs', `${surface.id} staging`);
    verifySignal(staging.traces, surface.staging, 'traces', `${surface.id} staging`);
  }

  return {
    primaryBackend: contract.primaryBackend.provider,
    externalOtlpProvider: contract.externalOtlp.provider,
    externalOtlpStatus: contract.externalOtlp.status,
    workerSurfaces: contract.surfaces.filter((surface) => surface.executionType !== 'static-assets-only').map((surface) => surface.id),
    staticSurfaces: contract.surfaces.filter((surface) => surface.executionType === 'static-assets-only').map((surface) => surface.id)
  };
}

if (require.main === module) {
  const result = verifyObservabilityContract();
  console.log(
    `Observability contract: PASS (native=${result.primaryBackend}; workers=${result.workerSurfaces.join(',')}; external OTLP=${result.externalOtlpProvider} ${result.externalOtlpStatus})`
  );
}

module.exports = { verifyObservabilityContract };
