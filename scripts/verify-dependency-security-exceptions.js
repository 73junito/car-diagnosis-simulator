'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXCEPTION_PATH = path.join(ROOT, 'data', 'security', 'dependency-risk-exceptions.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const LOCK_PATH = path.join(ROOT, 'package-lock.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function packageRecord(lock, name) {
  const key = `node_modules/${name}`;
  const record = lock.packages?.[key];
  if (!record) throw new Error(`Missing lockfile package record: ${key}`);
  return record;
}

function assertDependency(record, parent, child, expectedRange) {
  const actual = record.dependencies?.[child];
  if (actual !== expectedRange) {
    throw new Error(`Unexpected dependency edge ${parent} -> ${child}: expected ${expectedRange}, got ${actual || 'missing'}`);
  }
}

function verify() {
  const policy = readJson(EXCEPTION_PATH);
  const pkg = readJson(PACKAGE_PATH);
  const lock = readJson(LOCK_PATH);
  const exception = policy.exceptions?.find((item) => item.id === 'dependabot-alert-109');
  if (!exception) throw new Error('Missing dependency exception for Dependabot alert #109.');

  if (pkg.dependencies?.['sprintf-js'] || pkg.devDependencies?.['sprintf-js']) {
    throw new Error('sprintf-js must not be declared as a direct dependency.');
  }

  const sprintfRecords = Object.entries(lock.packages || {}).filter(([key]) =>
    key === 'node_modules/sprintf-js' || key.endsWith('/node_modules/sprintf-js')
  );
  if (sprintfRecords.length !== 1) {
    throw new Error(`Expected exactly one reviewed sprintf-js lockfile record, found ${sprintfRecords.length}.`);
  }

  const sprintf = packageRecord(lock, 'sprintf-js');
  if (sprintf.version !== exception.expected_version) {
    throw new Error(`sprintf-js version drift: expected reviewed ${exception.expected_version}, got ${sprintf.version}`);
  }
  if (sprintf.dev !== true) {
    throw new Error('sprintf-js is no longer dev-only.');
  }

  const argparse = packageRecord(lock, 'argparse');
  const jsYaml = packageRecord(lock, 'js-yaml');
  const nycConfig = packageRecord(lock, '@istanbuljs/load-nyc-config');
  const istanbul = packageRecord(lock, 'babel-plugin-istanbul');

  for (const [name, record] of [
    ['argparse', argparse],
    ['js-yaml', jsYaml],
    ['@istanbuljs/load-nyc-config', nycConfig],
    ['babel-plugin-istanbul', istanbul],
  ]) {
    if (record.dev !== true) throw new Error(`${name} is no longer dev-only in the reviewed chain.`);
  }

  const sprintfParents = Object.entries(lock.packages || {})
    .filter(([, record]) => record?.dependencies?.['sprintf-js'])
    .map(([key]) => key);
  if (sprintfParents.length !== 1 || sprintfParents[0] !== 'node_modules/argparse') {
    throw new Error(`Unexpected sprintf-js parent set: ${sprintfParents.join(', ') || 'none'}`);
  }

  assertDependency(argparse, 'argparse', 'sprintf-js', '~1.0.2');
  assertDependency(jsYaml, 'js-yaml', 'argparse', '^1.0.7');
  assertDependency(nycConfig, '@istanbuljs/load-nyc-config', 'js-yaml', '^3.13.1');
  assertDependency(istanbul, 'babel-plugin-istanbul', '@istanbuljs/load-nyc-config', '^1.0.0');

  const root = lock.packages?.[''] || {};
  if (root.dependencies?.['sprintf-js']) {
    throw new Error('sprintf-js entered production root dependencies.');
  }

  if (exception.production_runtime_allowed !== false || exception.direct_dependency_allowed !== false) {
    throw new Error('Alert #109 exception must explicitly prohibit production runtime and direct dependency use.');
  }

  return {
    alert: exception.id,
    package: exception.package,
    version: sprintf.version,
    status: exception.status,
    chain: exception.expected_chain,
    productionRuntimeAllowed: exception.production_runtime_allowed,
  };
}

if (require.main === module) {
  try {
    const result = verify();
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { verify };
