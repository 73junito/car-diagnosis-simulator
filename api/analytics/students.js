const path = require('path');

function loadReport() {
  const fs = require('fs');
  const reportPath = path.join(process.cwd(), 'reports', 'analytics.json');
  console.debug('[loadReport students] fs.readFileSync type:', typeof fs.readFileSync, 'hasMock:', !!fs.readFileSync?.mock);
  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    console.debug('[loadReport students] content', typeof content === 'string' ? content.slice(0,200) : content);
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function aggregateStudents() {
  const report = loadReport();
  const sessions = Array.isArray(report?.sessions) ? report.sessions : [];

  if (sessions.length === 0) {
    return { ok: true, totalStudents: 0, students: [] };
  }

  const perStudent = new Map();
  for (const session of sessions) {
    const id = session.userId || session.user || 'unknown';
    const current = perStudent.get(id) || { id, sessions: 0, scoreTotal: 0, confidenceTotal: 0 };
    current.sessions += 1;
    current.scoreTotal += Number(session.score) || 0;
    current.confidenceTotal += Number(session.confidence) || 0;
    perStudent.set(id, current);
  }

  const students = Array.from(perStudent.values()).map((s) => ({
    id: s.id,
    sessions: s.sessions,
    averageScore: round(s.scoreTotal / s.sessions, 0),
    averageConfidence: round(s.confidenceTotal / s.sessions, 2)
  }));

  return { ok: true, totalStudents: students.length, students };
}

function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    return res.json(aggregateStudents());
  } catch (err) {
    console.error('[/api/analytics/students]', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

module.exports = handler;
module.exports.aggregateStudents = aggregateStudents;

function registerStudentsRoutes(app) {
  app.get('/api/analytics/students', (req, res) => {
    try {
      return res.json(aggregateStudents());
    } catch (err) {
      console.error('[registerStudentsRoutes] error', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });
}

module.exports.registerStudentsRoutes = registerStudentsRoutes;
