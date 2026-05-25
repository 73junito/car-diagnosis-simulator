jest.mock('fs');
const fs = require('fs');

describe('aggregateStudents', () => {
  beforeEach(() => {
    jest.resetModules();
    fs.existsSync.mockReset();
    fs.readFileSync.mockReset();
  });

  test('computes per-student averages and totals from JSON report', () => {
    const mockReport = {
      sessions: [
        { userId: 's1', score: 90, confidence: 0.9 },
        { userId: 's1', score: 80, confidence: 0.8 },
        { userId: 's2', score: 70, confidence: 0.6 }
      ]
    };

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(mockReport));

    const students = require('../../api/analytics/students');
    const res = students.aggregateStudents();

    expect(res.ok).toBe(true);
    expect(res.totalStudents).toBe(2);

    const s1 = res.students.find(s => s.id === 's1');
    expect(s1).toBeDefined();
    expect(s1.sessions).toBe(2);
    expect(s1.averageScore).toBeCloseTo(85, 0);
    expect(s1.averageConfidence).toBeCloseTo(0.85, 2);
  });

  test('returns empty list when no report available', () => {
    fs.existsSync.mockReturnValue(false);
    const students = require('../../api/analytics/students');
    const res = students.aggregateStudents();
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.students)).toBe(true);
    expect(res.totalStudents).toBe(0);
  });
});
