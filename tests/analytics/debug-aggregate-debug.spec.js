jest.mock('fs');
const fs = require('fs');

describe('debug aggregateSessions mock state', () => {
  beforeEach(() => {
    jest.resetModules();
    fs.existsSync.mockReset();
    fs.readFileSync.mockReset();
  });

  test('log mock state around require', () => {
    const mockReport = {
      sessions: [
        { userId: 'u1', confidence: 0.8 },
        { userId: 'u1', confidence: 0.6 },
        { userId: 'u2', confidence: 0.5 }
      ]
    };

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(mockReport));

    console.debug('before require - readFileSync.mock:', !!fs.readFileSync.mock, 'mockReturnValue:', fs.readFileSync.mock && fs.readFileSync.mock.results);

    const sessions = require('../../api/analytics/sessions');

    console.debug('after require - readFileSync.mock:', !!fs.readFileSync.mock, 'mock.results:', fs.readFileSync.mock && fs.readFileSync.mock.results);

    const res = sessions.aggregateSessions();

    console.debug('after aggregate - readFileSync.mock.results:', fs.readFileSync.mock && fs.readFileSync.mock.results, 'res:', res);

    expect(res.totalSessions).toBe(3);
  });
});
