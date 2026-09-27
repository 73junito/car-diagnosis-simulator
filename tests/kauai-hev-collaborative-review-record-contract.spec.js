const fs = require('fs');
const path = require('path');

const recordPath = path.join(
  __dirname,
  '..',
  'data',
  'evidence',
  'review-queues',
  'kauai-hev-collaborative-review-record-20260927.json'
);

const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));

describe('Kauai HEV collaborative review record contract', () => {
  test('preserves review as non-approving metadata', () => {
    expect(record.review_session.approval_effect).toBe('none');
    expect(record.gate_state).toEqual(
      expect.objectContaining({
        rights_cleared: false,
        technically_reviewed: false,
        safety_reviewed: false,
        chunk_approved: false,
        lesson_mapped: false,
        question_generation_allowed: false,
        creates_chunks: false,
        ingests_content: false
      })
    );
  });
  test('anchors all six reviewed Kauai lesson files to exact hashes', () => {
    const hashes = Object.fromEntries(
      record.scope.source_files_reviewed.map((item) => [item.review_id, item.sha256])
    );

    expect(hashes).toEqual({
      'kauai-amt171-hv-safety':
        '82e328b622879afb5aaebd0e5defc149e140a8920883eb3c80276d63c82ce2e9',
      'kauai-amt171-dc-dc':
        '7ed292b6b2c405b17f6652358bf0645a89c8bedb6e739f1a0ef927c4f3c4f75e',
      'kauai-amt171-power-inverter':
        'f3bcbc505282a8d9319c21c06a48e1dd8530ebf086bf47ce522d7e12da8ab3b4',
      'kauai-amt172-inverter-battery-cooling':
        '1e568a60b319e5c5e71182cb03150e1c2dbb64e7663c27c9b40a5c583a8ada1c',
      'kauai-amt172-12v-subsystem':
        '084754b45bcbd0dad77326a3f950add6699be532c841457869ee3e2ca5de16f8',
      'kauai-amt173-energy-management-battery':
        '4a6caac6cfd119bf92b548546de6e0aadf50ac231788c5336ce55b57f507102f'
    });
  });
  test('keeps universal safety and diagnostic shortcuts blocked', () => {
    expect(record.blocked_universalizations).toEqual(
      expect.arrayContaining([
        'universal glove-class suitability',
        'cable color as sole high-voltage identification',
        'one-hand rule as a substitute for isolation and verification',
        'universal SOC, SOH, imbalance, capacity, isolation, or replacement thresholds',
        'diagnosis or replacement based on one DTC, one measurement, one snapshot, or one catalog value'
      ])
    );
  });

  test('does not register attached references as approved evidence', () => {
    expect(record.supporting_reference_boundary.status).toBe(
      'supporting-only-not-registered-by-this-record'
    );
    expect(record.supporting_reference_boundary.rules).toContain(
      'No attached reference is ingested, chunked, rights-cleared, technically approved, or lesson-mapped by this record.'
    );
  });
  test('records Option 2 as rights-pending without opening release gates', () => {
    expect(record.rights_review_decision).toEqual(
      expect.objectContaining({
        reviewer: 'Rafael Rodriguez',
        reviewer_id: 'rafael-rodriguez',
        decision: 'pending-third-party-and-licensor-authority-verification',
        user_selection: 'Option 2',
        status: 'framework-reference-only',
        rights_cleared: false,
        release_effect: 'none'
      })
    );
    expect(record.rights_review_decision.required_before_clearance).toEqual(
      expect.arrayContaining([
        'verify licensor authority for the package-level license statement',
        'verify third-party-material provenance and reuse rights'
      ])
    );
    expect(record.gate_state.rights_cleared).toBe(false);
    expect(record.gate_state.chunk_approved).toBe(false);
    expect(record.gate_state.question_generation_allowed).toBe(false);
  });
  test('enforces framework-reference-only use with original expression', () => {
    expect(record.rights_review_decision.framework_policy).toEqual(
      expect.objectContaining({
        classification: 'framework-reference-only / original-expression-required',
        direct_content_reuse: 'blocked-unless-separately-cleared'
      })
    );
    expect(record.rights_review_decision.framework_policy.permitted_use).toEqual(
      expect.arrayContaining([
        'study course organization, module sequence, topic categories, learning progression, and general instructional framework',
        'use those structural ideas as inspiration for independently authored AutoLearnPro curriculum'
      ])
    );
    expect(record.rights_review_decision.framework_policy.prohibited_without_separate_clearance).toContain(
      'ingesting or chunking Kauai source text as reusable instructional content'
    );
    expect(record.gate_state.rights_cleared).toBe(false);
    expect(record.gate_state.ingests_content).toBe(false);
    expect(record.gate_state.question_generation_allowed).toBe(false);
  });
});
