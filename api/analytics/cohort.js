function aggregateCohort(events = []) {
  const list = Array.isArray(events) ? events : [];
  return {
    ok: true,
    totalEvents: list.length,
    uniqueStudents: new Set(list.map(e => e.userId || e.user_id).filter(Boolean)).size
  };
}

function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  return res.status(200).json(aggregateCohort([]));
}

module.exports = handler;
module.exports.aggregateCohort = aggregateCohort;
