const fs = require('fs');
const path = require('path');

describe('charging-system technical revision contract', () => {
  const root = path.resolve(__dirname, '..');
  const revisions = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'evidence', 'review-queues', 'charging-system-technical-revisions.json'),
    'utf8'
  ));
  const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260925040000_revise_charging_system_distractors.sql'),
    'utf8'
  );

  test('revises exactly the two flagged distractors', () => {
    expect(revisions.revisions).toHaveLength(2);
    expect(revisions.revisions.map(r => r.question_id).sort()).toEqual([
      'charging-system-ai-draft-0f3a2f20daca',
      'charging-system-ai-draft-e67fed5cd983'
    ].sort());
  });

  test('replacement distractors are evidence-bounded concepts', () => {
    const byId = Object.fromEntries(revisions.revisions.map(r => [r.question_id, r]));
    expect(byId['charging-system-ai-draft-0f3a2f20daca'].revised_distractor)
      .toBe('DC diode rectification');
    expect(byId['charging-system-ai-draft-e67fed5cd983'].revised_distractor)
      .toBe('Voltage regulator');
  });

  test('revision resets technical-review completion and reviewer attribution', () => {
    expect(migration).toContain("'technical_review_complete', false");
    expect(migration).toContain('technical_reviewer_id = null');
    expect(migration).toContain('technical_reviewed_at = null');
  });

  test('revision does not approve or complete instructional review', () => {
    expect(migration).not.toContain("status = 'approved'");
    expect(revisions.governance.technical_review_complete).toBe(false);
    expect(revisions.governance.instructional_review_complete).toBe(false);
    expect(revisions.governance.approval_complete).toBe(false);
  });
});
