function buildHeatmap(events = []) {
  const counts = {};
  for (const e of Array.isArray(events) ? events : []) {
    const key = e.type || e.eventType || e.event_type || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return { ok: true, heatmap: counts };
}
module.exports = { buildHeatmap };
