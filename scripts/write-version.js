#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

async function main() {
  try {
    const version = process.env.APP_VERSION || process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
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

module.exports = { main };
