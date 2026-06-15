const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const registryPath = path.join(__dirname, 'models.json');

function loadRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function getInstalledModels() {
  try {
    const output = execSync('ollama list', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    return output
      .split(/\r?\n/)
      .slice(1)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.split(/\s+/)[0]);
  } catch (error) {
    console.error('Unable to run "ollama list".');
    return [];
  }
}

function findInstalled(preferredModels, installedModels) {
  for (const preferred of preferredModels) {
    if (installedModels.includes(preferred)) {
      return preferred;
    }
  }

  return null;
}

function selectModel(purpose = 'default') {
  const registry = loadRegistry();
  const installed = getInstalledModels();

  if (installed.length === 0) {
    return registry.default;
  }

  if (purpose === 'default') {
    return installed.includes(registry.default)
      ? registry.default
      : installed[0];
  }

  const preferredModels =
    registry.purposes[purpose] ||
    [registry.default];

  const selected = findInstalled(
    preferredModels,
    installed
  );

  if (selected) {
    return selected;
  }

  if (installed.includes(registry.default)) {
    return registry.default;
  }

  return installed[0];
}

function listPurposes() {
  const registry = loadRegistry();

  return Object.keys(registry.purposes)
    .sort();
}

if (require.main === module) {
  const arg = process.argv[2];

  if (arg === '--list') {
    console.log(listPurposes().join('\n'));
    process.exit(0);
  }

  const purpose = arg || 'default';

  const model = selectModel(purpose);

  console.log(model);
}

module.exports = {
  selectModel,
  listPurposes,
  getInstalledModels
};