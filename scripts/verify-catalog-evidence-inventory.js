'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const inventoryPath = path.join(root, 'catalog-evidence', 'inventory.json');

const REQUIRED_FALSE = [
  'citationAllowed',
  'ragIngestionAllowed',
  'modelContextAllowed',
  'reusableChunksAllowed',
  'transcriptIngestionAllowed',
  'figuresReuseAllowed',
  'engineeringValueImportAllowed',
  'assetGeometryCopyingAllowed',
  'publicationAllowed'
];

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function verifyCatalogEvidenceInventory(options = {}) {
  const errors = [];
  const assert = (condition, message) => { if (!condition) errors.push(message); };
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

  assert(inventory.schemaVersion === '1.0.0', 'schemaVersion must be 1.0.0');
  assert(inventory.inventoryType === 'local-candidate-source-inventory', 'inventoryType must remain local-candidate-source-inventory');
  assert(inventory.collection && inventory.collection.sourceFilesCommitted === false, 'PDF source bytes must not be committed');
  assert(inventory.collection && inventory.collection.observedArtifactCount === 29, 'expected snapshot count is 29');
  assert(inventory.authority && inventory.authority.candidateUsesArePermissions === false, 'candidate uses must never imply permission');
  assert(inventory.authority && inventory.authority.engineeringAuthority === 'none', 'inventory must have no engineering authority');
  assert(inventory.authority && inventory.authority.publicationAuthority === 'none', 'inventory must have no publication authority');
  assert(inventory.authority && inventory.authority.assessmentAuthority === 'none', 'inventory must have no assessment authority');

  for (const key of REQUIRED_FALSE) {
    assert(inventory.defaultGates && inventory.defaultGates[key] === false, `default gate ${key} must be false`);
  }

  const sources = Array.isArray(inventory.sources) ? inventory.sources : [];
  assert(sources.length === 29, `inventory must contain exactly 29 source records; found ${sources.length}`);

  const ids = new Set();
  const filenames = new Set();
  const hashes = new Set();

  for (const source of sources) {
    const label = source.sourceId || source.filename || 'unknown-source';
    assert(typeof source.sourceId === 'string' && source.sourceId.length > 2, `${label}: sourceId is required`);
    assert(!ids.has(source.sourceId), `${label}: duplicate sourceId`);
    ids.add(source.sourceId);

    assert(typeof source.filename === 'string' && source.filename.toLowerCase().endsWith('.pdf'), `${label}: filename must be a PDF`);
    assert(!filenames.has(source.filename.toLowerCase()), `${label}: duplicate filename`);
    filenames.add(source.filename.toLowerCase());

    assert(Number.isInteger(source.sizeBytes) && source.sizeBytes > 0, `${label}: sizeBytes must be positive`);
    assert(/^[a-f0-9]{64}$/.test(source.artifactSha256 || ''), `${label}: artifactSha256 must be lowercase SHA-256`);
    assert(!hashes.has(source.artifactSha256), `${label}: duplicate artifact SHA-256`);
    hashes.add(source.artifactSha256);

    assert(source.rightsStatus === 'unverified-local-reference', `${label}: rightsStatus must remain unverified-local-reference`);
    assert(source.reviewState === 'metadata-triaged-rights-unreviewed', `${label}: reviewState must remain fail-closed`);
    for (const key of REQUIRED_FALSE) {
      assert(source[key] === false, `${label}: ${key} must be false`);
    }

    assert(Array.isArray(source.domainCandidates) && source.domainCandidates.length > 0, `${label}: domainCandidates required`);
    assert(Array.isArray(source.componentFamilies) && source.componentFamilies.length > 0, `${label}: componentFamilies required`);
    assert(Array.isArray(source.candidateUses) && source.candidateUses.length > 0, `${label}: candidateUses required`);

    const prohibited = ['textExcerpt','permittedExcerpt','excerptSha256','approvedChunkIds','licenseOk','rightsVerifiedBy','rightsVerifiedAt','engineeringValues','assetGeometry'];
    for (const key of prohibited) {
      assert(!Object.prototype.hasOwnProperty.call(source, key), `${label}: prohibited field ${key}`);
    }
  }

  const sourceDir = options.sourceDir || process.env.CATALOG_SOURCE_DIR;
  if (sourceDir) {
    assert(fs.existsSync(sourceDir), `local verification directory does not exist: ${sourceDir}`);
    if (fs.existsSync(sourceDir)) {
      const actual = fs.readdirSync(sourceDir).filter((name) => name.toLowerCase().endsWith('.pdf'));
      assert(actual.length === sources.length, `local PDF count mismatch: expected ${sources.length}, found ${actual.length}`);
      for (const source of sources) {
        const filePath = path.join(sourceDir, source.filename);
        assert(fs.existsSync(filePath), `${source.sourceId}: local file missing`);
        if (!fs.existsSync(filePath)) continue;
        const stat = fs.statSync(filePath);
        assert(stat.size === source.sizeBytes, `${source.sourceId}: byte size mismatch`);
        assert(sha256File(filePath) === source.artifactSha256, `${source.sourceId}: SHA-256 mismatch`);
      }
    }
  }

  return { errors, count: sources.length };
}

if (require.main === module) {
  const result = verifyCatalogEvidenceInventory();
  if (result.errors.length) {
    console.error('[FAIL] Local catalog evidence inventory');
    for (const error of result.errors) console.error('  - ' + error);
    process.exit(1);
  }
  console.log(`[PASS] Local catalog evidence inventory: ${result.count} metadata-only candidates; rights/ingestion/publication remain fail-closed.`);
  if (process.env.CATALOG_SOURCE_DIR) console.log('[PASS] Local artifact count, byte sizes, and SHA-256 hashes verified.');
}

module.exports = { verifyCatalogEvidenceInventory, REQUIRED_FALSE };
