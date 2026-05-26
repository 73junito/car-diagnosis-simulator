function loadReport() {
  const fs = require('fs');                
  const path = require('path');
  const reportPath = path.join(__dirname, 'analytics-report.json');
  try {
    const exists = fs.existsSync && typeof fs.existsSync === 'function' ? fs.existsSync(reportPath) : undefined;
    try {
      console.debug('[loadReport sessions] fs keys:', Object.keys(fs));
    } catch (e) {
      console.debug('[loadReport sessions] fs keys: <unable to list>');
    }
    console.debug('[loadReport sessions] existsSync:', exists, 'path:', reportPath);
    if (exists === false) return { sessions: [] };
    const raw = fs.readFileSync(reportPath, 'utf8');
    console.debug('[loadReport sessions] readFileSync type:', typeof raw);
    return JSON.parse(raw);
  } catch (err) {
    return { sessions: [] };
  }
}

function round(value, digits = 3) {
  return Number(Number(value).toFixed(digits));
}

function aggregateSessions() {
  const report = loadReport();
  const sessions = Array.isArray(report && report.sessions) ? report.sessions : [];

  if (sessions.length === 0) {
    return {
      ok: true,
      totalSessions: 0,
      averageConfidence: 0,
      students: [],
    };
  }

  const totalSessions = sessions.length;
  const totalConfidence = sessions.reduce((sum, s) => sum + (Number(s.confidence) || 0), 0);
  const averageConfidence = round(totalConfidence / totalSessions, 3);

  const perStudent = new Map();
  for (const session of sessions) {
    const id = session.userId || session.user || 'unknown';
    if (!perStudent.has(id)) perStudent.set(id, { id, sessions: 0, confidenceSum: 0 });
    const cur = perStudent.get(id);
    cur.sessions += 1;
    cur.confidenceSum += Number(session.confidence) || 0;
  }

  const students = Array.from(perStudent.values()).map((s) => ({
    id: s.id,
    sessions: s.sessions,
    averageConfidence: round(s.confidenceSum / s.sessions, 3),
  }));

  return {
    ok: true,
    totalSessions,
    averageConfidence,
    students,
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
