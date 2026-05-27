const fs = require('fs');
const path = require('path');

function getVersion() {
  const sha = process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || null;
  if (sha) return sha;
  // fallback to timestamp
  return `ts-${Date.now()}`;
}

function writeVersionFile() {
  const version = getVersion();
  const builtAt = new Date().toISOString();
  const out = { version, builtAt };
  const outPath = path.join(__dirname, '..', 'public', 'version.json');
  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log('WROTE', outPath, out);
  } catch (err) {
    console.error('Failed to write version file', err);
    process.exit(1);
  }
}

if (require.main === module) {
  writeVersionFile();
}

module.exports = { getVersion, writeVersionFile };
