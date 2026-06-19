function buildReplay(events = []) {
  return {
    ok: true,
    events: (Array.isArray(events) ? events : []).sort((a, b) =>
      String(a.created_at || a.timestamp || "").localeCompare(String(b.created_at || b.timestamp || ""))
    )
  };
}

function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  return res.status(200).json(buildReplay([]));
}

module.exports = handler;
module.exports.buildReplay = buildReplay;
