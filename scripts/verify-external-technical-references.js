'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const registryPath = path.join(root, 'data/evidence/external-technical-references.json');
const sourceStatePath = path.join(root, 'data/evidence/source-state-registry.json');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const sourceState = JSON.parse(fs.readFileSync(sourceStatePath, 'utf8'));

const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

assert(registry.schemaVersion === '1.0.0', 'external reference schemaVersion must be 1.0.0');
assert(registry.registryType === 'external-technical-reference', 'registryType must be external-technical-reference');
assert(Array.isArray(registry.sources) && registry.sources.length > 0, 'sources must be a non-empty array');

const canonicalSourceIds = new Set((sourceState.sources || []).map((source) => source.source_id));
const seen = new Set();

for (const source of registry.sources || []) {
  assert(typeof source.source_id === 'string' && source.source_id.length > 0, 'every external reference requires source_id');
  assert(!seen.has(source.source_id), `duplicate external source_id ${source.source_id}`);
  seen.add(source.source_id);

  assert(!canonicalSourceIds.has(source.source_id),
    `external reference ${source.source_id} must not duplicate a canonical evidence source_id`);
  assert(source.evidence_role === 'external-technical-reference',
    `source ${source.source_id}: evidence_role must be external-technical-reference`);
  assert(source.citation_allowed === true,
    `source ${source.source_id}: citation_allowed must be true`);
  assert(source.ollama_eligible === false,
    `source ${source.source_id}: ollama_eligible must be false`);
  assert(source.reusable_chunks_allowed === false,
    `source ${source.source_id}: reusable_chunks_allowed must be false`);
  assert(source.transcript_ingestion_allowed === false,
    `source ${source.source_id}: transcript_ingestion_allowed must be false`);
  assert(source.figures_reuse_allowed === false,
    `source ${source.source_id}: figures_reuse_allowed must be false`);
  assert(typeof source.rights_status === 'string' && source.rights_status.includes('external-reference-only'),
    `source ${source.source_id}: rights_status must remain external-reference-only`);
  assert(typeof source.canonical_url === 'string' && source.canonical_url.startsWith('https://'),
    `source ${source.source_id}: canonical_url must be https`);
  assert(Array.isArray(source.references) && source.references.length > 0,
    `source ${source.source_id}: references must be non-empty`);

  const prohibitedFields = ['text_excerpt', 'permitted_excerpt', 'excerpt_sha256', 'approved_chunk_ids', 'chunk_decisions'];
  for (const field of prohibitedFields) {
    assert(!Object.prototype.hasOwnProperty.call(source, field),
      `source ${source.source_id}: field ${field} is prohibited in citation-only registry`);
  }

  for (const reference of source.references || []) {
    assert(typeof reference.locator === 'string' && reference.locator.trim().length > 0,
      `source ${source.source_id}: every reference requires a locator`);
    assert(typeof reference.supports_claim === 'string' && reference.supports_claim.trim().length > 0,
      `source ${source.source_id}: every reference requires a project-authored supports_claim`);
    assert(!Object.prototype.hasOwnProperty.call(reference, 'excerpt'),
      `source ${source.source_id}: references may not store vendor excerpt text`);
    assert(!Object.prototype.hasOwnProperty.call(reference, 'quote'),
      `source ${source.source_id}: references may not store vendor quotations`);
  }
}

if (errors.length) {
  console.error('[FAIL] External technical reference contract violated');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `[PASS] External technical reference contract verified: ${registry.sources.length} citation-only sources, 0 ingestible vendor sources`
);
