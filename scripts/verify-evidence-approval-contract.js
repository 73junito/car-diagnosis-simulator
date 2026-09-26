'use strict';

/**
 * Evidence Approval Contract guard.
 *
 * Establishes ONE canonical approval authority and fails closed when any
 * other record disagrees with it.
 *
 *   Canonical authority : public.source_chunks.approved / .status
 *                         (mirrored here by data/evidence/open-scholarly/
 *                          scholarly-evidence-chunks.json)
 *   Non-authoritative   : data/evidence/review-queues/*.json
 *
 * Review-queue documents are working notes. They may describe a chunk as
 * "approved", but they can never grant approval. Only the canonical record
 * can. This guard detects and reports that class of shadow approval.
 *
 * Canonical source states are kept separate and are never collapsed:
 *   ingested → rights_cleared → technically_reviewed
 *            → chunk_approved → lesson_mapped
 *
 * Read-only: this script never writes, promotes, or synthesises approval
 * state, reviewer identity, or timestamps.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

const CHUNK_FILE = 'data/evidence/open-scholarly/scholarly-evidence-chunks.json';
const MANIFEST_FILE = 'data/evidence/open-scholarly/scholarly-source-manifest.json';
const REGISTRY_FILE = 'data/evidence/source-state-registry.json';
const REVIEW_DIR = 'data/evidence/review-queues';

// The five independent lifecycle gates. None may be inferred from another.
const GATES = ['ingested', 'rights_cleared', 'technically_reviewed', 'chunk_approved', 'lesson_mapped'];
// Gates that require a recorded human reviewer identity before they can be true.
const REVIEWER_GATED_GATES = [
  ['rights_cleared', 'rights_verified_by', 'rights_verified_at'],
  ['technically_reviewed', 'technically_reviewed_by', 'technically_reviewed_at']
];

const errors = [];
const warnings = [];
const conflicts = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}


/**
 * Recursively collect chunk-id claims from review-queue documents.
 *
 * Chunk ids are matched by the CLAIM KEY (e.g. `approved_chunks`), never by
 * inspecting the id text itself: real ids such as
 * "frontiers-alternator-primary-source-p7" contain no "chunk" substring, so
 * filtering on the value would silently drop genuine approval claims.
 */
function collectChunkIdClaims(node, claims, trail = 'root') {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectChunkIdClaims(item, claims, `${trail}[${index}]`));
    return;
  }
  if (!node || typeof node !== 'object') return;

  for (const [key, value] of Object.entries(node)) {
    const isChunkKey = /chunk|excerpt/i.test(key);

    if (isChunkKey && Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string') {
          claims.push({ trail: `${trail}.${key}`, key, value: entry });
        }
      }
    } else if (isChunkKey && typeof value === 'string') {
      claims.push({ trail: `${trail}.${key}`, key, value });
    }

    collectChunkIdClaims(value, claims, `${trail}.${key}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Canonical chunk authority
// ---------------------------------------------------------------------------
const chunkDoc = readJson(CHUNK_FILE);
const manifest = readJson(MANIFEST_FILE);
assert(Array.isArray(chunkDoc.chunks), 'scholarly-evidence-chunks.json must contain a chunks array');

const canonicalById = new Map();
for (const chunk of chunkDoc.chunks) {
  assert(typeof chunk.chunk_id === 'string', 'every canonical chunk requires a chunk_id');
  assert(
    typeof chunk.approved === 'boolean',
    `canonical chunk ${chunk.chunk_id} must carry a boolean approved flag`
  );
  canonicalById.set(chunk.chunk_id, chunk);
}

const approvedChunkIds = chunkDoc.chunks
  .filter((chunk) => chunk.approved === true)
  .map((chunk) => chunk.chunk_id);


// ---------------------------------------------------------------------------
// 2. Shadow-approval detection: review queues vs canonical record
// ---------------------------------------------------------------------------
const approvalClaimKeys =
  /^(approved_chunks|approved_chunk_ids|approved_excerpts|approved_excerpt_ids)$/i;

if (fs.existsSync(path.join(root, REVIEW_DIR))) {
  for (const file of fs.readdirSync(path.join(root, REVIEW_DIR)).sort()) {
    if (!file.endsWith('.json')) continue;

    let doc;
    try {
      doc = readJson(path.join(REVIEW_DIR, file));
    } catch (error) {
      errors.push(`review queue ${file} is not valid JSON: ${error.message}`);
      continue;
    }

    const claims = [];
    collectChunkIdClaims(doc, claims);

    for (const claim of claims) {
      if (!approvalClaimKeys.test(claim.key)) continue;

      const canonical = canonicalById.get(claim.value);
      if (!canonical) {
        warnings.push(
          `${file} references unknown chunk "${claim.value}" (${claim.trail}); no canonical record exists`
        );
        continue;
      }

      if (canonical.approved === true) continue;

      conflicts.push({
        type: 'approval_state_conflict',
        record: `${REVIEW_DIR}/${file}`,
        location: claim.trail,
        chunkId: claim.value,
        canonicalStatus: canonical.status,
        canonicalApproved: canonical.approved
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Source-state registry: independent gates, separated artifacts
// ---------------------------------------------------------------------------
const registry = readJson(REGISTRY_FILE);
assert(registry.schemaVersion === '1.0.0', 'source-state-registry schemaVersion must be 1.0.0');
assert(Array.isArray(registry.sources), 'source-state-registry must contain a sources array');

const registryById = new Map();
for (const source of registry.sources) {
  assert(typeof source.source_id === 'string' && source.source_id.length > 0,
    'every registry source requires a source_id');
  assert(!registryById.has(source.source_id), `duplicate registry source_id ${source.source_id}`);
  registryById.set(source.source_id, source);

  // Every gate must be an explicit boolean, never inferred or absent.
  for (const gate of GATES) {
    assert(
      typeof source[gate] === 'boolean',
      `source ${source.source_id} must declare boolean gate "${gate}"`
    );
  }

  // A reviewer-gated gate may not be true without a recorded human identity.
  for (const [gate, byField, atField] of REVIEWER_GATED_GATES) {
    if (source[gate] !== true) continue;
    assert(
      typeof source[byField] === 'string' && source[byField].length > 0,
      `source ${source.source_id}: ${gate}=true requires a real ${byField}`
    );
    assert(
      typeof source[atField] === 'string' && source[atField].length > 0,
      `source ${source.source_id}: ${gate}=true requires ${atField}`
    );
  }

  // chunk_approved must agree with the canonical chunk record.
  if (source.chunk_approved === true) {
    const claimed = source.approved_chunk_ids || [];
    assert(Array.isArray(claimed), `source ${source.source_id}: approved_chunk_ids must be an array`);
    for (const chunkId of claimed) {
      const canonical = canonicalById.get(chunkId);
      assert(
        canonical && canonical.approved === true,
        `source ${source.source_id} claims approved chunk ${chunkId} but the canonical record does not approve it`
      );
    }
  }

  // A pending rights decision must never be paired with a cleared gate.
  if (source.rights_decision === 'pending') {
    assert(
      source.rights_cleared !== true,
      `source ${source.source_id}: rights_cleared=true contradicts rights_decision="pending"`
    );
  }
}

// The Frontiers article and the Navy chapter are distinct artifacts and must
// never share a source record, rights classification, or approval state.
const frontiers = registryById.get('frontiers-automotive-alternator-2023');
const navy = registryById.get('navy-navedtra-14264a-ch8');
assert(frontiers, 'registry must contain the Frontiers CC BY source record');
assert(navy, 'registry must contain the Navy candidate source record');
if (frontiers && navy) {
  assert(frontiers.source_id !== navy.source_id, 'Frontiers and Navy must be separate source records');
  assert(
    frontiers.rights_classification !== navy.rights_classification ||
      frontiers.rights_classification_source !== navy.rights_classification_source,
    'Frontiers and Navy must not share an identical rights classification provenance'
  );
  const frontiersSha = frontiers.artifact_sha256;
  const navySha = navy.artifact_sha256;
  if (frontiersSha && navySha) {
    assert(frontiersSha !== navySha, 'Frontiers and Navy artifacts must not share a sha256');
  }
}

// ---------------------------------------------------------------------------
// 4. A declared license must carry a reference
// ---------------------------------------------------------------------------
for (const source of manifest.sources || []) {
  const hasLicense =
    typeof source.license_classification === 'string' && source.license_classification.length > 0;
  if (!hasLicense) continue;
  assert(
    source.license_url || source.license_classification === 'unknown',
    `source ${source.id} declares license "${source.license_classification}" but no license reference`
  );
  if (source.reviewer_approved === true) {
    warnings.push(
      `manifest source ${source.id} sets reviewer_approved=true with no reviewer identity or timestamp; ` +
      'this is not a rights decision and must not be read as one'
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Fail closed
// ---------------------------------------------------------------------------
// Report EVERY problem class before exiting. Exiting on the first class would
// hide registry violations (for example chunk_approved=true claiming a chunk
// the canonical record does not approve) behind an earlier shadow-approval
// conflict, so an operator could "fix" one and never see the other.
for (const warning of warnings) {
  console.warn(`  [warn] ${warning}`);
}

if (conflicts.length > 0) {
  console.error('[FAIL] Evidence approval contract: shadow approval detected');
  for (const conflict of conflicts) {
    console.error(`  - ${conflict.type}: ${conflict.record} ${conflict.location}`);
    console.error(
      `      chunk "${conflict.chunkId}": canonical status="${conflict.canonicalStatus}" approved=${conflict.canonicalApproved}`
    );
  }
  console.error(
    `      ${conflicts.length} conflict(s). Review-queue records are non-authoritative and cannot grant approval.`
  );
  console.error('      Human rights review must set canonical chunk state; the agent must not auto-promote.');
}

if (errors.length > 0) {
  console.error('[FAIL] Evidence approval contract violated');
  for (const error of errors) console.error(`  - ${error}`);
}

if (conflicts.length > 0 || errors.length > 0) {
  process.exit(1);
}

console.log(
  `[PASS] Evidence approval contract verified: ${chunkDoc.chunks.length} canonical chunks, ` +
    `${approvedChunkIds.length} approved, 0 shadow-approval conflicts`
);
