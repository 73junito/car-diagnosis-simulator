const { aggregateSessions } = require('./sessions');

// Vercel serverless handler — returns a small analytics summary
module.exports = (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const data = aggregateSessions();
    res.status(200).json({
      ok:                true,
      totalSessions:     data.totalSessions || 0,
      averageConfidence: data.averageConfidence || 0,
      totalStudents:     Array.isArray(data.students) ? data.students.length : 0,
      aseWeaknesses:     data.aseWeaknesses || [],
    });
  } catch (err) {
    console.error('[/api/analytics/summary]', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
