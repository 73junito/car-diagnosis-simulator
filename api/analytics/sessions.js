const path = require('path');

function loadReport() {
  const fs = require('fs');
  const reportPath = path.join(process.cwd(), 'reports', 'analytics.json');
  console.debug('[loadReport sessions] fs.readFileSync type:', typeof fs.readFileSync, 'hasMock:', !!fs.readFileSync?.mock);
  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    console.debug('[loadReport sessions] content', typeof content === 'string' ? content.slice(0,200) : content);
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function round(value, digits = 3) {
  return Number(Number(value).toFixed(digits));
}

function aggregateSessions() {
  const report = loadReport();
  const sessions = Array.isArray(report?.sessions) ? report.sessions : [];

  if (sessions.length === 0) {
    return {
      ok: true,
      totalSessions: 0,
      averageConfidence: 0,
      students: []
    };
  }

  const totalSessions = sessions.length;
  const averageConfidence = round(sessions.reduce((sum, s) => sum + (Number(s.confidence) || 0), 0) / totalSessions, 3);

  const perStudent = new Map();
  for (const session of sessions) {
    const id = session.userId || session.user || 'unknown';
    const current = perStudent.get(id) || { id, sessions: 0, confidenceTotal: 0 };
    current.sessions += 1;
    current.confidenceTotal += Number(session.confidence) || 0;
    perStudent.set(id, current);
  }

  const students = Array.from(perStudent.values()).map((s) => ({
    id: s.id,
    sessions: s.sessions,
    averageConfidence: round(s.confidenceTotal / s.sessions, 3)
  }));

  return {
    ok: true,
    totalSessions,
    averageConfidence,
    students
  };
}

function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    return res.json(aggregateSessions());
  } catch (err) {
    console.error('[/api/analytics/sessions]', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

module.exports = handler;
module.exports.aggregateSessions = aggregateSessions;

function registerSessionsRoutes(app) {
  app.get('/api/analytics/sessions', (req, res) => {
    try {
      return res.json(aggregateSessions());
    } catch (err) {
      console.error('[registerSessionsRoutes] error', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });
}

module.exports.registerSessionsRoutes = registerSessionsRoutes;
