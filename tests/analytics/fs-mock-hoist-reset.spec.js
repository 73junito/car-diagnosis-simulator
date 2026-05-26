jest.mock('fs');
let fs;

describe('fs hoist + resetModules repro', () => {
  beforeEach(() => {
    jest.resetModules();
    fs = require('fs');
    fs.existsSync.mockReset && fs.existsSync.mockReset();
    fs.readFileSync.mockReset && fs.readFileSync.mockReset();
  });

  test('top-level jest.mock + resetModules then set mockReturnValue (should work)', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ sessions: [ { userId: 'u1', confidence: 0.8 }, { userId: 'u2', confidence: 0.6 }, { userId: 'u1', confidence: 0.7 } ] }));

    const sessions = require('../../api/analytics/sessions');
    const res = sessions.aggregateSessions();
    expect(res.ok).toBe(true);
    expect(res.totalSessions).toBe(3);
  });
});
