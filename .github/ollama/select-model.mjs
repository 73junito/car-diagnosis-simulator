import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const registryPath = join(__dirname, 'registry.json');

function loadRegistry() {
  return JSON.parse(readFileSync(registryPath, 'utf8'));
}

function getInstalledModels() {
  try {
    return execSync('ollama list', { encoding: 'utf8' })
      .split(/\r?\n/)
      .slice(1)
      .map(line => line.trim().split(/\s+/)[0])
      .filter(Boolean);
  } catch {
    return [];
  }
}

function selectModel(purpose = 'completion') {
  const registry = loadRegistry();
  const installed = getInstalledModels();

  if (!registry.purposes) {
    throw new Error(
      `Invalid registry: missing purposes in ${registryPath}`
    );
  }

  const preferred =
    registry.purposes[purpose] ||
    registry.fallbacks?.coding ||
    registry.fallbacks?.completion ||
    'llama3.1:8b';

  if (installed.length === 0) {
    return preferred;
  }

  if (installed.includes(preferred)) {
    return preferred;
  }

  const fallback =
    registry.fallbacks?.completion ||
    installed[0];

  return installed.includes(fallback)
    ? fallback
    : installed[0];
}

function listPurposes() {
  const registry = loadRegistry();
  return Object.keys(registry.purposes || {}).sort();
}

/*
 * ESM replacement for require.main === module
 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];

  if (arg === '--list') {
    console.log(listPurposes().join('\n'));
    process.exit(0);
  }

  console.log(selectModel(arg || 'completion'));
}

export {
  selectModel,
  listPurposes,
  getInstalledModels
};

export default {
  selectModel,
  listPurposes,
  getInstalledModels
};