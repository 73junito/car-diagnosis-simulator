const fs = require('fs');
const path = require('path');
const {
  validateCaptureInventory,
  formatSummary
} = require('../scripts/validate-charging-system-artifact-capture-inventory');

describe('charging-system artifact-capture inventory contract', () => {
  const root = path.resolve(__dirname, '..');
  const inventory = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'evidence', 'review-queues',
      'charging-system-artifact-capture-inventory-20261003.json'),
    'utf8'
  ));
  const manifest = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'evidence', 'review-queues',
      'charging-system-challenge-candidate-source-manifest-20261003.json'),
    'utf8'
  ));
  const rightsRecords = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'evidence', 'review-queues',
      'charging-system-rights-review-records-20261003.json'),
    'utf8'
  ));

  test('passes the fail-closed inventory validator', () => {
    const { errors } = validateCaptureInventory();
    expect(errors).toEqual([]);
  });

  test('records identity, retrieval facts and hashes for every candidate', () => {
    expect(inventory.stage).toBe('artifact-capture-pending-human-rights-review');
    expect(inventory.artifacts.length).toBe(6);
    const artifactIds = inventory.artifacts.map((row) => row.candidate_id).sort();
    const candidateIds = manifest.source_candidates.map((source) => source.candidate_id).sort();
    expect(artifactIds).toEqual(candidateIds);

    for (const row of inventory.artifacts) {
      expect(row.canonical_url).toMatch(/^https:\/\//);
      expect(row.retrieval_url).toMatch(/^https:\/\//);
      expect(row.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(row.artifact_filename.length).toBeGreaterThan(0);
      expect(['exact-source', 'mirror', 'metadata-only', 'unavailable']).toContain(row.capture_kind);

      if (row.artifact_capture_status === 'captured') {
        expect(row.artifact_sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(row.artifact_byte_length).toBeGreaterThan(0);
        expect(row.artifact_media_type.length).toBeGreaterThan(0);
      } else {
        expect(row.artifact_sha256).toBeNull();
        expect(row.unavailable_reason.length).toBeGreaterThan(0);
      }
    }
  });

  test('reports unavailable captures honestly without substituting artifacts', () => {
    const unavailable = inventory.artifacts.filter((row) => row.artifact_capture_status === 'unavailable');
    expect(unavailable.length).toBe(2);
    for (const row of unavailable) {
      expect(row.artifact_sha256).toBeNull();
      expect(row.unavailable_reason.length).toBeGreaterThan(0);
      expect(row.artifact_capture_status).toBe('unavailable');
    }

    const metadataOnly = unavailable.filter((row) => row.capture_kind === 'metadata-only');
    expect(metadataOnly).toHaveLength(1);
    expect(metadataOnly[0].metadata_only_evidence.declared_content_length).toBeGreaterThan(0);
  });

  test('flags mirror and unstable-hash rows instead of presenting them as canonical', () => {
    const mirror = inventory.artifacts.filter((row) => row.capture_kind === 'mirror');
    expect(mirror).toHaveLength(1);
    expect(mirror[0].canonical_vs_retrieved_mismatch.length).toBeGreaterThan(0);

    const unstable = inventory.artifacts.filter((row) => row.repeat_retrieval_hash_stable === false);
    expect(unstable.length).toBeGreaterThan(0);
    for (const row of unstable) {
      expect(row.canonical_vs_retrieved_mismatch.length).toBeGreaterThan(0);
    }

    const output = formatSummary(inventory.summary);
    expect(output).toContain('sources_in_inventory: 6');
    expect(output).toContain('artifacts_captured: 4');
    expect(output).toContain('artifacts_unavailable: 2');
  });

  test('contains no mapping, review or approval fields and records no rights decision', () => {
    const walk = (value) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === 'object') {
        for (const [key, nested] of Object.entries(value)) {
          expect(key).not.toMatch(/claim|draft|question_id|mapping|technical|instructional|approv|eligib|rights_decision|reviewer_identity/i);
          walk(nested);
        }
      }
    };
    walk(inventory);

    for (const review of rightsRecords.reviews) {
      expect(review.rights_decision).toBe('pending');
      expect(review.reviewer_identity).toBeNull();
      expect(review.artifact_sha256).toBeNull();
    }
  });
});