const fs = require('fs');
const path = require('path');

describe('charging-system human review packet contract', () => {
  const root = path.resolve(__dirname, '..');
  const packet = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'evidence', 'review-queues', 'charging-system-human-review-packet.json'),
    'utf8'
  ));
  const sql = fs.readFileSync(
    path.join(root, 'supabase', 'drafts', 'charging-system-human-review-completion.sql'),
    'utf8'
  );

  test('contains exactly six validated review candidates', () => {
    expect(packet.questions).toHaveLength(6);
    expect(new Set(packet.questions.map(q => q.question_id)).size).toBe(6);
  });

  test('all human review decisions remain pending', () => {
    for (const q of packet.questions) {
      expect(q.review.technical_decision).toBe('pending');
      expect(q.review.instructional_decision).toBe('pending');
    }
    expect(packet.governance.technical_review_complete).toBe(false);
    expect(packet.governance.instructional_review_complete).toBe(false);
    expect(packet.governance.approval_complete).toBe(false);
  });

  test('completion template uses the independent staging developer reviewer', () => {
    expect(sql).toContain('9d924a87-361e-417d-9094-44de9df1fc0d');
    expect(sql).not.toContain('TECHNICAL_REVIEWER_UUID');
    expect(sql).toContain('INSTRUCTIONAL_REVIEWER_UUID');
    expect(sql).toContain('technical_reviewer_id');
    expect(sql).toContain('instructional_reviewer_id');
  });

  test('completion template requires valid deterministic citation validation', () => {
    expect(sql).toContain("cv.validator_version = 'citation-validator-1.0'");
    expect(sql).toContain("cv.result = 'valid'");
    expect(sql).toContain('cv.source_hashes_verified = true');
    expect(sql).toContain('cv.excerpts_verified = true');
    expect(sql).toContain('cv.urls_verified = true');
  });

  test('completion template never promotes to approved', () => {
    expect(sql).not.toContain("set status = 'approved'");
    expect(sql).not.toContain("status='approved'");
    expect(sql).toContain("qp.status = 'validated'");
  });
});
