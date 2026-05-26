jest.mock('fs');
let fs;

describe('aggregateSessions', () => {
  beforeEach(() => {
    jest.resetModules();
    fs = require('fs');
    fs.existsSync.mockReset();
    fs.readFileSync.mockReset();
  });

  test('aggregates totalSessions, averageConfidence and per-student stats from JSON report', () => {
    const mockReport = {
      sessions: [
        { userId: 'u1', confidence: 0.8 },
        { userId: 'u1', confidence: 0.6 },
        { userId: 'u2', confidence: 0.5 }
      ]
    };

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(mockReport));

    const sessions = require('../../api/analytics/sessions');
    const res = sessions.aggregateSessions();

    expect(res.ok).toBe(true);
    expect(res.totalSessions).toBe(3);
    // code rounds averageConfidence to 3 decimal places
    expect(res.averageConfidence).toBeCloseTo(0.633, 3);

    const u1 = res.students.find(s => s.id === 'u1');
    expect(u1).toBeDefined();
    expect(u1.sessions).toBe(2);
    expect(u1.averageConfidence).toBeCloseTo(0.7, 3);
  });

  test('returns empty shape when no report files exist', () => {
    fs.existsSync.mockReturnValue(false);
    const sessions = require('../../api/analytics/sessions');
    const res = sessions.aggregateSessions();
    expect(res.ok).toBe(true);
    expect(res.totalSessions).toBe(0);
    expect(Array.isArray(res.students)).toBe(true);
  });
});
