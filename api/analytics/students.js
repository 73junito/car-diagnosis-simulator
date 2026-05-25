const fs = require('fs');
const path = require('path');

function loadStudentReport() {
  const p = path.resolve('reports/student-performance-report.json');
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
  }
  const csv = path.resolve('reports/student-performance.csv');
  if (fs.existsSync(csv)) {
    const txt = fs.readFileSync(csv, 'utf8');
    const lines = txt.split(/\r?\n/).filter(Boolean);
    const headers = lines.shift().split(',').map(h => h.replace(/"/g, ''));
    const rows = lines.map(l => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/));
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

function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    return res.json(aggregateStudents());
  } catch (err) {
    console.error('[/api/analytics/students]', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

// Default export must be a function for Vercel serverless. Attach helpers
// to the exported function so other modules (e.g. summary) can access them.
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
