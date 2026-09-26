'use strict';

/**
 * Evidence Approval Contract — machine guard against shadow approval.
 *
 * The contract:
 *   - public.source_chunks (mirrored by scholarly-evidence-chunks.json) is the
 *     ONLY authority on whether a chunk is approved.
 *   - data/evidence/review-queues/*.json are working notes and can never
 *     grant approval.
 *   - a review record claiming approval for a chunk whose canonical record is
 *     not approved is an approval_state_conflict and must fail closed.
 */
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const scriptPath = path.join(root, 'scripts', 'verify-evidence-approval-contract.js');
const chunkFile = path.join(root, 'data', 'evidence', 'open-scholarly', 'scholarly-evidence-chunks.json');
const manifestFile = path.join(root, 'data', 'evidence', 'open-scholarly', 'scholarly-source-manifest.json');

const readJson = (file) => JSON.parse(require('fs').readFileSync(file, 'utf8'));
const readFileSync = (file, encoding) => require('fs').readFileSync(file, encoding);

function runGuard() {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath], { encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      status: error.status,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

describe('Evidence approval contract', () => {
  test('canonical chunk records are well formed', () => {
    const doc = readJson(chunkFile);
    expect(Array.isArray(doc.chunks)).toBe(true);
    expect(doc.chunks.length).toBeGreaterThan(0);
    for (const chunk of doc.chunks) {
      expect(typeof chunk.chunk_id).toBe('string');
      expect(typeof chunk.approved).toBe('boolean');
    }
  });

  test('the guard fails closed when review queues claim unapproved chunks are approved', () => {
    const result = runGuard();

    // The repository currently contains shadow approval, so the guard MUST fail.
    // If this ever passes silently, the detector has regressed.
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('shadow approval detected');
    expect(result.stderr).toContain('approval_state_conflict');
    expect(result.stderr).toMatch(/canonical status="draft" approved=false/);
  });

  test('every conflict names a chunk that the canonical record does not approve', () => {
    const result = runGuard();
    const doc = readJson(chunkFile);
    const unapproved = new Set(doc.chunks.filter((c) => c.approved !== true).map((c) => c.chunk_id));

    const reported = [...result.stderr.matchAll(/chunk "([^"]+)":/g)].map((m) => m[1]);
    expect(reported.length).toBeGreaterThan(0);
    for (const chunkId of reported) {
      expect(unapproved.has(chunkId)).toBe(true);
    }
  });

  test('conflicts are reported across more than one review record', () => {
    const result = runGuard();
    const records = [...result.stderr.matchAll(/(review-queues\/[\w.-]+\.json)/g)].map((m) => m[1]);
    expect(new Set(records).size).toBeGreaterThan(1);
  });

  test('the guard never mutates canonical evidence state', () => {
    const before = require('fs').readFileSync(chunkFile, 'utf8');
    runGuard();
    const after = require('fs').readFileSync(chunkFile, 'utf8');
    expect(after).toBe(before);
  });

  test('source manifest keeps a reusable license reference for declared licenses', () => {
    const manifest = readJson(manifestFile);
    for (const source of manifest.sources || []) {
      if (!source.license_classification || source.license_classification === 'unknown') continue;
      expect(
        source.license_url || source.license_classification === 'unknown'
      ).toBeTruthy();
    }
  });
});

describe('Evidence source-state registry', () => {
  const registryFile = path.join(root, 'data', 'evidence', 'source-state-registry.json');
  const GATES = [
    'ingested',
    'rights_cleared',
    'technically_reviewed',
    'chunk_approved',
    'lesson_mapped'
  ];

  test('declares the five independent lifecycle gates for every source', () => {
    const registry = readJson(registryFile);
    expect(registry.schemaVersion).toBe('1.0.0');
    expect(registry.sources.length).toBeGreaterThan(0);

    for (const source of registry.sources) {
      for (const gate of GATES) {
        expect(typeof source[gate]).toBe('boolean');
      }
    }
  });

  test('keeps the Frontiers CC BY source separate from the Navy candidate artifact', () => {
    const registry = readJson(registryFile);
    const frontiers = registry.sources.find((s) => s.source_id === 'frontiers-automotive-alternator-2023');
    const navy = registry.sources.find((s) => s.source_id === 'navy-navedtra-14264a-ch8');

    expect(frontiers).toBeTruthy();
    expect(navy).toBeTruthy();
    expect(frontiers.source_id).not.toBe(navy.source_id);

    // Distinct rights provenance: CC BY license vs an undecided candidate.
    expect(frontiers.rights_classification).toBe('CC_BY');
    expect(frontiers.rights_decision).toBe('pending');
    expect(navy.rights_classification).toBe('PUBLIC_DOMAIN');
    expect(navy.rights_decision).toBe('pending');
    expect(navy.rights_classification_source).toMatch(/candidate/i);

    // The Navy artifact is hashed in intake; the Frontiers manifest is not.
    expect(navy.artifact_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test('no gate is true while the underlying decision is still pending', () => {
    const registry = readJson(registryFile);
    for (const source of registry.sources) {
      if (source.rights_decision === 'pending') {
        expect(source.rights_cleared).toBe(false);
        expect(source.chunk_approved).toBe(false);
        expect(source.lesson_mapped).toBe(false);
      }
    }
  });

  test('no reviewer-gated gate is true without a recorded reviewer identity', () => {
    const registry = readJson(registryFile);
    for (const source of registry.sources) {
      if (source.rights_cleared === true) {
        expect(typeof source.rights_verified_by).toBe('string');
        expect(source.rights_verified_by.length).toBeGreaterThan(0);
        expect(source.rights_verified_at).toBeTruthy();
      }
      if (source.technically_reviewed === true) {
        expect(typeof source.technically_reviewed_by).toBe('string');
        expect(source.technically_reviewed_by.length).toBeGreaterThan(0);
        expect(source.technically_reviewed_at).toBeTruthy();
      }
    }
  });

  test('no chunk is claimed as approved in the registry', () => {
    const registry = readJson(registryFile);
    for (const source of registry.sources) {
      expect(source.chunk_approved).toBe(false);
      expect(source.approved_chunk_ids).toEqual([]);
    }
  });

  test('candidate chunks are recorded as candidates, not approvals', () => {
    const registry = readJson(registryFile);
    const frontiers = registry.sources.find((s) => s.source_id === 'frontiers-automotive-alternator-2023');
    expect(frontiers.candidate_chunk_ids.length).toBe(2);
    expect(frontiers.approved_chunk_ids).toEqual([]);
  });

  test('every candidate chunk has a pending chunk decision', () => {
    const registry = readJson(registryFile);
    for (const source of registry.sources) {
      for (const decision of source.chunk_decisions) {
        expect(decision.decision).toBe('pending');
        expect(decision.approved).toBe(false);
        expect(decision.reviewed_by).toBeNull();
        expect(decision.reviewed_at).toBeNull();
        expect(decision.review_notes).toBeNull();
      }
    }
  });

  test('chunk decisions use one of the three representable review states', () => {
    const registry = readJson(registryFile);
    const allowed = ['pending', 'approved', 'denied'];
    for (const source of registry.sources) {
      for (const decision of source.chunk_decisions) {
        expect(allowed).toContain(decision.decision);
        // approved is derived from decision and must always agree with it.
        const expected = decision.decision === 'approved';
        expect(decision.approved).toBe(expected);
      }
    }
  });

  test('no source or chunk review notes are pre-filled by the agent', () => {
    const registry = readJson(registryFile);
    for (const source of registry.sources) {
      expect(source.review_notes).toBeNull();
    }
  });

  test('the guard enforces gate ordering for any approved chunk', () => {
    // No chunk is approved, so the enforcement path must not fire on real data.
    const registry = readJson(registryFile);
    for (const source of registry.sources) {
      for (const decision of source.chunk_decisions) {
        if (decision.approved === true) {
          expect(source.rights_cleared).toBe(true);
          expect(source.technically_reviewed).toBe(true);
          expect(decision.reviewed_by).toBeTruthy();
          expect(decision.reviewed_at).toBeTruthy();
        }
      }
    }

    // And the rule exists in the guard source itself.
    const guardSource = readFileSync(
      path.join(root, 'scripts', 'verify-evidence-approval-contract.js'),
      'utf8'
    );
    expect(guardSource).toMatch(/approved=true requires source .* rights_cleared=true/);
    expect(guardSource).toMatch(/approved=true requires source .* technically_reviewed=true/);
    expect(guardSource).toMatch(/requires a real chunk-level reviewed_by/);
    expect(guardSource).toMatch(/must equal/);
    expect(guardSource).toMatch(/does not belong to source/);
  });

  test('the guard supports a denied decision distinct from pending', () => {
    const guardSource = readFileSync(
      path.join(root, 'scripts', 'verify-evidence-approval-contract.js'),
      'utf8'
    );
    expect(guardSource).toMatch(/pending:\s*false/);
    expect(guardSource).toMatch(/approved:\s*true/);
    expect(guardSource).toMatch(/denied:\s*false/);
  });
});
