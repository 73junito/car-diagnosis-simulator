const fs = require('fs');
const path = require('path');
const vm = require('vm');

const cwd = process.cwd();
const assetsDir = path.join(cwd, 'assets', 'images', 'scenarios');
const placeholderName = 'placeholder-scenario.svg';
const placeholderPath = path.join(assetsDir, placeholderName);

function runFileInSandbox(filePath, sandbox) {
  const code = fs.readFileSync(filePath, 'utf8');
  vm.runInNewContext(code, sandbox, { filename: filePath });
}

function loadRegistry() {
  const sandbox = { window: {}, console, process, setTimeout, setInterval };
  const scenariosFile = path.join(cwd, 'data', 'scenarios.js');
  const registryFile = path.join(cwd, 'data', 'scenario-registry.js');
  if (!fs.existsSync(scenariosFile) || !fs.existsSync(registryFile)) {
    throw new Error('Required data files missing');
  }
  runFileInSandbox(scenariosFile, sandbox);
  runFileInSandbox(registryFile, sandbox);
  return sandbox.window && sandbox.window.SCENARIO_REGISTRY ? sandbox.window.SCENARIO_REGISTRY : [];
}

function normalize() {
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  const registry = loadRegistry();
  const existingFiles = fs.readdirSync(assetsDir).filter(f => fs.statSync(path.join(assetsDir, f)).isFile());

  let normalized = 0;
  let placeholderUsed = 0;
  let missing = 0;
  const mappings = [];

  registry.forEach(entry => {
    const slug = entry.id;
    const targetName = `${slug}.svg`;
    const targetPath = path.join(assetsDir, targetName);
    if (fs.existsSync(targetPath)) {
      normalized += 1;
      mappings.push({ id: slug, status: 'exists', file: targetName });
      return;
    }

    // find candidate among existing files
    const lcSlug = slug.toLowerCase();
    const candidate = existingFiles.find(f => {
      const name = f.toLowerCase();
      const noext = name.replace(/\.svg$/,'');
      if (noext === lcSlug) return true;
      if (noext.includes(lcSlug)) return true;
      // allow underscores vs dashes
      if (noext.replace(/[-_]/g,'') === lcSlug.replace(/[-_]/g,'')) return true;
      return false;
    });

    if (candidate) {
      // copy candidate to normalized target
      try {
        fs.copyFileSync(path.join(assetsDir, candidate), targetPath);
        normalized += 1;
        mappings.push({ id: slug, status: 'copied', from: candidate, to: targetName });
        // add new file to existingFiles to avoid rematching
        existingFiles.push(targetName);
        return;
      } catch (e) {
        // fallthrough to placeholder
      }
    }

    // no candidate found — copy placeholder into place
    if (fs.existsSync(placeholderPath)) {
      fs.copyFileSync(placeholderPath, targetPath);
      placeholderUsed += 1;
      mappings.push({ id: slug, status: 'placeholder', file: targetName });
    } else {
      missing += 1;
      mappings.push({ id: slug, status: 'missing', file: targetName });
    }
  });

  const report = { normalized, placeholderUsed, missing, total: registry.length, mappings };
  const outPath = path.join(cwd, 'scripts', 'normalized-assets-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`normalized: ${normalized}`);
  console.log(`placeholder used: ${placeholderUsed}`);
  console.log(`missing: ${missing}`);
  console.log(`report: ${outPath}`);
  return report;
}

if (require.main === module) {
  try {
    normalize();
  } catch (err) {
    console.error('Normalization failed:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
}

module.exports = { normalize };
