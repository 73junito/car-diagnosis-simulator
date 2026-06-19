function buildHeatmap(events = []) {
  const counts = {};
  for (const e of Array.isArray(events) ? events : []) {
    const key = e.type || e.eventType || e.event_type || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return { ok: true, heatmap: counts };
}

function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  return res.status(200).json(buildHeatmap([]));
}

module.exports = handler;
module.exports.buildHeatmap = buildHeatmap;
