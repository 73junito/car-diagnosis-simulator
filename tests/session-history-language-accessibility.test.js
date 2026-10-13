const fs = require('fs');
const path = require('path');

describe('standalone dashboard language contract', () => {
  test('Instructor Session History declares English document language', () => {
    const html = fs.readFileSync(
      path.resolve(__dirname, '..', 'dashboard', 'instructor', 'session-history.html'),
      'utf8'
    );

    expect(html).toMatch(/<html\s+lang=["']en["']/i);
  });
});
