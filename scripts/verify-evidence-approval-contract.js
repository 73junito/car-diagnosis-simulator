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
const REVIEW_DIR = 'data/evidence/review-queues';

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
// 3. A declared license must carry a reference
// ---------------------------------------------------------------------------
for (const source of manifest.sources || []) {
  const hasLicense =
    typeof source.license_classification === 'string' && source.license_classification.length > 0;
  if (!hasLicense) continue;
  assert(
    source.license_url || source.license_classification === 'unknown',
    `source ${source.id} declares license "${source.license_classification}" but no license reference`
  );
}

// ---------------------------------------------------------------------------
// 4. Fail closed
// ---------------------------------------------------------------------------
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
  process.exit(1);
}

for (const warning of warnings) {
  console.warn(`  [warn] ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`  - ${error}`);
  console.error('[FAIL] Evidence approval contract violated');
  process.exit(1);
}

console.log(
  `[PASS] Evidence approval contract verified: ${chunkDoc.chunks.length} canonical chunks, ` +
    `${approvedChunkIds.length} approved, 0 shadow-approval conflicts`
);
