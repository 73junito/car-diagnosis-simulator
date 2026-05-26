/* Minimal repro for fs mock / require ordering
 * Scenarios:
 * - hoisted mock (jest.mock at file top)
 * - doMock before require
 * - manual mockReturnValue after require
 */

describe('fs mock ordering repro', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('hoisted jest.mock at top (auto-mock) behaves as expected', () => {
    jest.mock('fs');
    const fs = require('fs');
    // set return values on the auto-mock
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ sessions: [ { userId: 'u1', confidence: 0.8 }, { userId: 'u2', confidence: 0.4 }, { userId: 'u1', confidence: 0.7 } ] }));

    const sessions = require('../../api/analytics/sessions');
    const res = sessions.aggregateSessions();
    expect(res.ok).toBe(true);
    expect(res.totalSessions).toBe(3);
  });

  test('jest.doMock before require applies dynamic mock', () => {
    jest.doMock('fs', () => ({
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() => JSON.stringify({ sessions: [ { userId: 'u1', confidence: 0.5 }, { userId: 'u2', confidence: 0.6 } ] }))
    }));

    const sessions = require('../../api/analytics/sessions');
    const res = sessions.aggregateSessions();
    expect(res.ok).toBe(true);
    expect(res.totalSessions).toBe(2);
  });

  test('require fs then set mockReturnValue then require aggregator', () => {
    jest.mock('fs');
    const fs = require('fs');
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ sessions: [ { userId: 'u1', confidence: 0.9 } ] }));

    const sessions = require('../../api/analytics/sessions');
    const res = sessions.aggregateSessions();
    expect(res.ok).toBe(true);
    expect(res.totalSessions).toBe(1);
  });
});
