const fs = require('fs');
const path = require('path');

describe('OBD-II student form accessibility contract', () => {
  const html = fs.readFileSync(
    path.resolve(__dirname, '..', 'dashboard', 'obd2-student.html'),
    'utf8'
  );

  test('symptom textarea has an explicit label', () => {
    expect(html).toContain('<label for="symptom-text">Observed symptoms</label>');
    expect(html).toContain('<textarea id="symptom-text"');
  });

  test('diagnosis input has an explicit label', () => {
    expect(html).toContain('<label for="diagnosis-input">Your diagnosis</label>');
    expect(html).toContain('<input id="diagnosis-input"');
  });
});
