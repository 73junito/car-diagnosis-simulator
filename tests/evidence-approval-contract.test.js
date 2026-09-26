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
