describe('fs mock repro', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('jest.mock before require', () => {
    jest.mock('fs');
    const fs = require('fs');
    const mockReport = { sessions: [ { userId: 'u1', confidence: 0.8 }, { userId: 'u1', confidence: 0.6 }, { userId: 'u2', confidence: 0.5 } ] };
    fs.readFileSync.mockReturnValue(JSON.stringify(mockReport));
    const sessions = require('../../api/analytics/sessions');
    const res = sessions.aggregateSessions();
    expect(res.totalSessions).toBe(3);
  });

  test('doMock factory before require', () => {
    jest.doMock('fs', () => ({ readFileSync: jest.fn(() => JSON.stringify({ sessions: [ { userId: 'u1', confidence: 0.8 }, { userId: 'u1', confidence: 0.6 }, { userId: 'u2', confidence: 0.5 } ] })) }));
    const sessions = require('../../api/analytics/sessions');
    const res = sessions.aggregateSessions();
    expect(res.totalSessions).toBe(3);
  });

  test('require before mock', () => {
    const sessions = require('../../api/analytics/sessions');
    // now mock fs
    jest.mock('fs');
    const fs = require('fs');
    fs.readFileSync.mockReturnValue(JSON.stringify({ sessions: [ { userId: 'u1', confidence: 0.8 }, { userId: 'u1', confidence: 0.6 }, { userId: 'u2', confidence: 0.5 } ] }));
    const res = sessions.aggregateSessions();
    // depending on module caching this may fail
    expect(res.totalSessions).toBe(3);
  });
});
