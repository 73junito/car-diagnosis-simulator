const fs = require('fs');
const path = require('path');
const root = path.resolve('.');
const audit = fs.readFileSync(path.join(root, 'docs/redesign-architecture-audit.md'), 'utf8');
const roadmap = fs.readFileSync(path.join(root, 'docs/phase-4-functional-gap-roadmap.md'), 'utf8');

describe('Phase 4 functional gap roadmap', () => {
  test('Phase 3 sequence documentation uses durable HTML arrow entities', () => {
    expect(audit).toContain('Concern &rarr; Evidence &rarr; Evaluate &rarr; Test &rarr; Verify');
    expect(audit).not.toContain('Concern ? Evidence ? Evaluate ? Test ? Verify');
  });

  test('roadmap covers all remaining product surfaces', () => {
    for (const heading of [
      'Instructor workspace completeness',
      'Institutional tenant model and portal',
      'Platform administration dashboard',
      'Student transcript is a static shell',
      'Student activity is a static shell',
      'Student Coach is static while recommendation API exists',
      'Dedicated governed reference-library experience',
      'Public interactive demo case'
    ]) expect(roadmap).toContain(heading);
  });

  test('roadmap prioritizes production authorization/runtime gaps', () => {
    expect(roadmap).toContain('Canonical role and authorization model');
    expect(roadmap).toContain('Production API parity for instructor classroom features');
    expect(roadmap).toContain('Instructor verification review/decision workflow');
    expect(roadmap).toContain('No browser role/localStorage value can authorize privileged data.');
  });
});
