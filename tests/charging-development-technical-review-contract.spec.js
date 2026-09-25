const fs = require('fs');
const path = require('path');

describe('charging-system development technical review', () => {
  const review = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '..', 'data', 'evidence', 'review-queues', 'charging-system-development-technical-review.json'),
    'utf8'
  ));

  test('reviews exactly six citation-validated questions', () => {
    expect(review.decisions).toHaveLength(6);
    expect(new Set(review.decisions.map(d => d.question_id)).size).toBe(6);
  });

  test('records four pass, two revise, zero reject decisions', () => {
    const counts = review.decisions.reduce((acc, d) => {
      acc[d.decision] = (acc[d.decision] || 0) + 1;
      return acc;
    }, {});
    expect(counts.pass).toBe(4);
    expect(counts.revise).toBe(2);
    expect(counts.reject || 0).toBe(0);
    expect(review.summary).toEqual({ pass: 4, revise: 2, reject: 0 });
  });

  test('uses the independent staging developer reviewer identity', () => {
    expect(review.reviewer.profile_uuid).toBe('9d924a87-361e-417d-9094-44de9df1fc0d');
    expect(review.reviewer.role).toBe('developer_reviewer');
    expect(review.reviewer.environment).toBe('staging');
  });

  test('does not claim approval or instructional completion', () => {
    expect(review.constraints.join(' ')).toContain('No question is approved');
    expect(review.constraints.join(' ')).toContain('Instructional review remains separate and incomplete');
  });

  test('revision decisions identify evidence-bounded distractor ambiguity', () => {
    const revise = review.decisions.filter(d => d.decision === 'revise');
    expect(revise.map(d => d.question_id).sort()).toEqual([
      'charging-system-ai-draft-0f3a2f20daca',
      'charging-system-ai-draft-e67fed5cd983'
    ].sort());
    for (const decision of revise) {
      expect(decision.reason).toMatch(/approved evidence/i);
      expect(decision.reason).toMatch(/distractor|classification/i);
    }
  });
});
