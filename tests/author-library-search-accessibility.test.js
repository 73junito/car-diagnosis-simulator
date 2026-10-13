const fs = require('fs');
const path = require('path');

describe('Authoring Studio accessibility contract', () => {
  test('Scenario Library search has a programmatic accessible name', () => {
    const html = fs.readFileSync(
      path.resolve(__dirname, '..', 'dashboard', 'author', 'index.html'),
      'utf8'
    );

    expect(html).toContain(
      'id="librarySearchInput" type="search" aria-label="Search scenario library"'
    );
  });
});
