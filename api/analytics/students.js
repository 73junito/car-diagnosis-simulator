let initError = null;
let implementation = null;

try {
  const fs = require('fs');
  const path = require('path');

  function loadStudentReport() {
    const p = path.join(process.cwd(), 'reports', 'student-performance-report.json');
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
    }
    const csv = path.join(process.cwd(), 'reports', 'student-performance.csv');
    if (fs.existsSync(csv)) {
      const txt = fs.readFileSync(csv, 'utf8');
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

  function aggregateStudents() {
    const report = loadStudentReport() || {};
    const sessions = report.sessions || report.data || [];
    const map = new Map();
    for (const s of sessions) {
      const uid = s.userId || s.user || s.studentId || s.student || 'unknown';
      const score = Number(s.score || s.totalScore || s.percent || 0) || 0;
      const conf = Number(s.confidence || s.avgConfidence || 0) || 0;
      const entry = map.get(uid) || { id: uid, sessions: 0, totalScore: 0, totalConfidence: 0 };
      entry.sessions += 1;
      entry.totalScore += score;
      entry.totalConfidence += conf;
      map.set(uid, entry);
    }
    const students = Array.from(map.values()).map(s => ({ id: s.id, sessions: s.sessions, averageScore: s.sessions? s.totalScore/s.sessions:0, averageConfidence: s.sessions? s.totalConfidence/s.sessions:0 }));
    return { ok: true, students, totalStudents: students.length };
  }

  function registerStudentsRoutes(app) {
    app.get('/api/analytics/students', (req, res) => {
      res.json(aggregateStudents());
    });
  }

  implementation = { aggregateStudents, registerStudentsRoutes };
} catch (err) {
  initError = err;
}

module.exports = function handler(req, res) {
  if (initError) {
    return res.status(500).json({ ok: false, error: 'analytics_init_failed', message: String(initError && initError.message), stack: process.env.NODE_ENV === 'production' ? undefined : (initError && initError.stack) });
  }

  if (req.method && req.method.toUpperCase() !== 'GET') return res.status(405).end();

  try {
    const data = implementation.aggregateStudents();
    return res.status(200).json(data);
  } catch (err) {
    console.error('students handler error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'analytics_handler_failed', message: String(err && err.message ? err.message : err) });
  }
};

// Attach named exports for Express integration when available
if (implementation) {
  module.exports.registerStudentsRoutes = implementation.registerStudentsRoutes;
  module.exports.aggregateStudents = implementation.aggregateStudents;
}
