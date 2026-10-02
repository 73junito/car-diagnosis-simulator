#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

function resolveVersion(env = process.env) {
  return (
    env.GITHUB_SHA ||
    env.WORKERS_CI_COMMIT_SHA ||
    env.GIT_COMMIT ||
    env.APP_VERSION ||
    'dev'
  );
}

async function main() {
  try {
    const version = resolveVersion();
    const outDir = path.resolve(__dirname, '..', 'public');
    const outFile = path.join(outDir, 'version.json');

    await fs.mkdir(outDir, { recursive: true });
    const payload = { version, written_at: new Date().toISOString() };
    await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Wrote version.json -> ${outFile}`);
  } catch (err) {
    console.error('Failed to write version.json', err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, resolveVersion };
