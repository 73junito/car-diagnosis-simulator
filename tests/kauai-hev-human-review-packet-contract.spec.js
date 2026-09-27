'use strict';

const fs = require('fs');
const path = require('path');

describe('Kauai HEV human review packet contract', () => {
  const root = path.resolve(__dirname, '..');
  const packet = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'evidence', 'review-queues', 'kauai-hev-human-review-packet-20260927.json'),
    'utf8'
  ));

  test('packet is review-only and advances no approval gate', () => {
    expect(packet.source_id).toBe('kauai-cc-dol-auto-green-tech-package');
    expect(packet.policy.advances_approval_gates).toBe(false);
    expect(packet.policy.creates_chunks).toBe(false);
    expect(packet.policy.ingests_content).toBe(false);
    expect(packet.policy.question_generation_allowed).toBe(false);
    expect(packet.policy.lesson_mapping_status).toBe('proposed-only');
    expect(packet.reviewer_fields.rights_reviewer).toBe('Rafael Rodriguez');
    expect(packet.reviewer_fields.rights_reviewed_at).toBeTruthy();
    expect(packet.reviewer_fields.rights_decision).toBe('pending-third-party-and-licensor-authority-verification');
    expect(packet.reviewer_fields.technical_reviewer).toBeNull();
    expect(packet.reviewer_fields.safety_reviewer).toBeNull();
    expect(packet.reviewer_fields.overall_decision).toBe('pending');
  });

  test('reviews exactly the two selected priority files with stable hashes', () => {
    expect(packet.files).toHaveLength(2);
    const byRole = Object.fromEntries(packet.files.map((item) => [item.role, item]));
    expect(byRole['high-voltage-electrical-safety'].sha256)
      .toBe('82e328b622879afb5aaebd0e5defc149e140a8920883eb3c80276d63c82ce2e9');
    expect(byRole['dc-dc-converter'].sha256)
      .toBe('7ed292b6b2c405b17f6652358bf0645a89c8bedb6e739f1a0ef927c4f3c4f75e');
    expect(packet.files.every((item) => item.embedded_media_count === 0)).toBe(true);
    expect(packet.files.every((item) => item.decision === 'pending')).toBe(true);
  });

  test('safety-sensitive procedures remain blocked pending human review', () => {
    const hv = packet.files.find((item) => item.role === 'high-voltage-electrical-safety');
    const dc = packet.files.find((item) => item.role === 'dc-dc-converter');

    expect(hv.candidate_reuse_boundary.blocked_pending_review).toEqual(
      expect.arrayContaining([
        'specific glove-class suitability claims',
        'specific high-voltage cable-color identification rule',
        'specific meter category selection guidance',
        'insulation-test procedure',
        'service-plug procedure'
      ])
    );

    expect(dc.candidate_reuse_boundary.blocked_pending_review).toEqual(
      expect.arrayContaining([
        'wiring-diagram procedure',
        '12-volt output test procedure',
        'specific voltage expectations',
        'safety procedure around energized converter circuits'
      ])
    );
  });

  test('decision rules require named human review before reuse or chunk approval', () => {
    const rules = packet.decision_rules.join(' ');
    expect(rules).toMatch(/Reviewer name and timestamp are required/);
    expect(rules).toMatch(/No chunk may be created or approved until rights and technical gates are complete/);
    expect(rules).toMatch(/No safety-sensitive procedure may become learner instruction without explicit technical and safety review/);
  });
});
