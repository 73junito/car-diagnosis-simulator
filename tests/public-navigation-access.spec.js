const fs = require('fs');
const path = require('path');

describe('public navigation access policy', () => {
  const root = path.resolve(__dirname, '..');
  const navigation = fs.readFileSync(path.join(root, 'theme', 'navigation.js'), 'utf8');
  const routes = fs.readFileSync(path.join(root, 'config', 'routes.js'), 'utf8');

  test('shows current non-paid public surfaces', () => {
    for (const label of ['Home', 'Docs', 'Contact', 'Privacy', 'Terms']) {
      expect(navigation).toContain(`label: '${label}'`);
    }
  });

  test('does not advertise paid or entitlement-controlled product routes', () => {
    const prohibited = [
      'STUDENT_DASHBOARD',
      'STUDENT_SCENARIO',
      'ANALYTICS',
      'SESSION_HISTORY',
      'INSTRUCTOR_',
      'AUTHORING_STUDIO',
      'DIAGNOSTICS_',
      'training_access',
      'certification_exam_attempt'
    ];

    for (const token of prohibited) {
      expect(navigation).not.toContain(token);
      expect(routes).not.toContain(token);
    }
  });
});
