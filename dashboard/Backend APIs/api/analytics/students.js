function loadReport() {
  const fs = require('fs');                
  const path = require('path');
  const reportPath = path.join(__dirname, 'analytics-report.json');
  try {
    const raw = fs.readFileSync(reportPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { sessions: [] };
  }
}

const { setAppVersionHeader } = require('../_utils/app-version');

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function aggregateStudents() {
  const report = loadReport();
  const sessions = Array.isArray(report && report.sessions) ? report.sessions : [];

  if (sessions.length === 0) {
    return { ok: true, totalStudents: 0, students: [] };
  }

  const perStudent = new Map();
  for (const session of sessions) {
    const id = session.userId || session.user || 'unknown';
    if (!perStudent.has(id)) perStudent.set(id, { id, sessions: 0, scoreSum: 0, confidenceSum: 0 });
    const cur = perStudent.get(id);
    cur.sessions += 1;
    cur.scoreSum += Number(session.score) || 0;
    cur.confidenceSum += Number(session.confidence) || 0;
  }

  const students = Array.from(perStudent.values()).map((s) => ({
    id: s.id,
    sessions: s.sessions,
    averageScore: s.sessions ? round(s.scoreSum / s.sessions, 0) : 0,
    averageConfidence: s.sessions ? round(s.confidenceSum / s.sessions, 2) : 0,
  }));

  return { ok: true, totalStudents: students.length, students };
}

function handler(req, res) {
  setAppVersionHeader(res);
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

