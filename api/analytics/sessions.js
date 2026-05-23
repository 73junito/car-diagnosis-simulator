let initError = null;
let implementation = null;

try {
  const fs = require('fs');
  const path = require('path');

  function loadReport() {
    const pJson = path.join(process.cwd(), 'reports', 'student-performance-report.json');
    const pCsv = path.join(process.cwd(), 'reports', 'student-performance.csv');
    if (fs.existsSync(pJson)) {
      try { return JSON.parse(fs.readFileSync(pJson, 'utf8')); } catch (e) { return null; }
    }
    // fallback: try to read CSV (very simple parsing)
    if (fs.existsSync(pCsv)) {
      const txt = fs.readFileSync(pCsv, 'utf8');
      const lines = txt.split(/\r?\n/).filter(Boolean);
      const headers = lines.shift().split(',').map(h => h.replace(/"/g, ''));
      const rows = lines.map(l => l.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/));
      const sessions = rows.map(cols => {
        const obj = {};
        headers.forEach((h,i)=> obj[h]=cols[i]||'');
        return obj;
      });
      return { sessions };
    }
    return null;
  }

  function aggregateSessions() {
    const report = loadReport() || {};
    const sessions = report.sessions || report.data || [];
    const totalSessions = sessions.length;
    // compute averageConfidence if present
    let avg = null;
    const confs = [];
    const studentsMap = new Map();
    for (const s of sessions) {
      const c = Number(s.confidence || s.avgConfidence || s.averageConfidence || s.confidenceAverage || 0) || 0;
      if (!isNaN(c)) confs.push(c);
      const uid = s.userId || s.user || s.studentId || s.student || s.userId;
      if (uid) {
        const entry = studentsMap.get(uid) || { id: uid, sessions: 0, totalConfidence: 0 };
        entry.sessions += 1;
        entry.totalConfidence += c;
        studentsMap.set(uid, entry);
      }
    }
    if (confs.length) avg = confs.reduce((a,b)=>a+b,0)/confs.length;

    const students = Array.from(studentsMap.values()).map(s => ({ id: s.id, sessions: s.sessions, averageConfidence: s.sessions? s.totalConfidence/s.sessions:0 }));

    // ASE weaknesses: try to read from report. If not present, empty array
    const aseWeaknesses = report.aseWeaknesses || report.weaknesses || [];

    const exports = [];
    const csv = path.join(process.cwd(), 'reports', 'student-performance.csv');
    const xapi = path.join(process.cwd(), 'reports', 'xapi-statements.json');
    if (fs.existsSync(csv)) exports.push('student-performance.csv');
    if (fs.existsSync(xapi)) exports.push('xapi-statements.json');

    return {
      ok: true,
      totalSessions,
      averageConfidence: avg === null ? 0 : Number(avg.toFixed(3)),
      students,
      aseWeaknesses,
      exports
    };
  }

  function registerSessionsRoutes(app) {
    app.get('/api/analytics/sessions', (req, res) => {
      res.json(aggregateSessions());
    });
  }

  implementation = { aggregateSessions, registerSessionsRoutes };
} catch (err) {
  initError = err;
}

module.exports = function handler(req, res) {
  if (initError) {
    return res.status(500).json({ ok: false, error: 'analytics_init_failed', message: String(initError && initError.message), stack: process.env.NODE_ENV === 'production' ? undefined : (initError && initError.stack) });
  }

  if (req.method && req.method.toUpperCase() !== 'GET') return res.status(405).end();

  try {
    const data = implementation.aggregateSessions();
    return res.status(200).json(data);
  } catch (err) {
    console.error('sessions handler error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'analytics_handler_failed', message: String(err && err.message ? err.message : err) });
  }
};

