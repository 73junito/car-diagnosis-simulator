'use strict';

const {
  buildApprovedProvenanceBackfill,
} = require('../src/ai/runtime/approved-provenance-bootstrap');

function fixture() {
  return {
    runId: 'approved-provenance-run',
    question: {
      question_id: 'charging-system-alternator-function-01',
      created_at: '2026-08-26T01:40:00.000Z',
    },
    provenance: {
      id: 'prov-1',
      question_id: 'charging-system-alternator-function-01',
      status: 'approved',
      validation_checklist: {
        license_ok: true,
        url_canonical: true,
        answer_verified: true,
        quote_in_source: true,
        source_checksum: true,
        explanation_verified: true,
        citation_matches_excerpt: true,
      },
      technical_reviewer_id: 'reviewer-1',
      technical_reviewed_at: '2026-08-26T01:44:45.374Z',
      instructional_reviewer_id: 'reviewer-1',
      instructional_reviewed_at: '2026-08-26T01:44:45.374Z',
      approved_by: 'reviewer-1',
      approved_at: '2026-08-26T01:44:45.374Z',
    },
    citationValidation: {
      id: 'validation-1',
      validation_method: 'deterministic-source-chunk-verification',
      source_hashes_verified: true,
      excerpts_verified: true,
      urls_verified: true,
      result: 'valid',
      validated_at: '2026-08-26T01:48:55.955Z',
    },
    citations: [
      { source_id: 'source-1', chunk_id: 'chunk-1', role: 'supports-answer' },
      { source_id: 'source-1', chunk_id: 'chunk-1', role: 'supports-explanation' },
    ],
    sourceEvidence: [
      {
        source_id: 'source-1',
        chunk_id: 'chunk-1',
        chunk_status: 'approved',
        chunk_approved: true,
        source_status: 'approved',
        license_reviewed_at: '2026-08-26T01:44:45.374Z',
        license: {
          rights_status: 'human_reviewed_approved',
          reuse_permission_verified: true,
        },
      },
      {
        source_id: 'source-1',
        chunk_id: 'chunk-1',
        chunk_status: 'approved',
        chunk_approved: true,
        source_status: 'approved',
        license_reviewed_at: '2026-08-26T01:44:45.374Z',
        license: {
          rights_status: 'human_reviewed_approved',
          reuse_permission_verified: true,
        },
      },
    ],
    importedAt: '2026-10-05T19:00:00.000Z',
  };
}

describe('approved provenance orchestration bootstrap', () => {
  test('builds the complete seven-state governance history without claiming agent execution', () => {
    const entries = buildApprovedProvenanceBackfill(fixture());

    expect(entries.map((entry) => entry.state)).toEqual([
      'drafted',
      'evidence_mapped',
      'rights_reviewed',
      'technically_reviewed',
      'citation_validated',
      'instructionally_reviewed',
      'final_content_approved',
    ]);
    expect(entries).toHaveLength(7);
    expect(entries.every((entry) => entry.action === 'provenance-state-backfilled')).toBe(true);
    expect(entries.every((entry) => entry.metadata.historicalImport === true)).toBe(true);
    expect(entries.every((entry) => entry.metadata.notAgentExecution === true)).toBe(true);
    expect(entries[6]).toMatchObject({
      actor: 'human',
      state: 'final_content_approved',
      metadata: expect.objectContaining({
        reviewerIdentity: 'reviewer-1',
        approvalEvidence: 'question_provenance:prov-1',
      }),
    });
  });

  test('fails closed when final approval evidence is absent', () => {
    const input = fixture();
    input.provenance.approved_by = null;
    expect(() => buildApprovedProvenanceBackfill(input))
      .toThrow(/Final human approval evidence is incomplete/);
  });

  test('fails closed when a required validation checklist item is false', () => {
    const input = fixture();
    input.provenance.validation_checklist.license_ok = false;
    expect(() => buildApprovedProvenanceBackfill(input))
      .toThrow(/Validation checklist failed: license_ok/);
  });

  test('fails closed when citation validation is not valid', () => {
    const input = fixture();
    input.citationValidation.result = 'invalid';
    expect(() => buildApprovedProvenanceBackfill(input))
      .toThrow(/Citation validation result is not valid/);
  });

  test('fails closed when required citation roles are missing', () => {
    const input = fixture();
    input.citations = [{ source_id: 'source-1', chunk_id: 'chunk-1', role: 'supports-answer' }];
    expect(() => buildApprovedProvenanceBackfill(input))
      .toThrow(/supports-explanation/);
  });

  test('fails closed when source reuse rights are not verified', () => {
    const input = fixture();
    input.sourceEvidence[0].license.reuse_permission_verified = false;
    expect(() => buildApprovedProvenanceBackfill(input))
      .toThrow(/Source reuse permission is not verified/);
  });
});
