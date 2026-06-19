function buildReplay(events = []) {
  return {
    ok: true,
    events: (Array.isArray(events) ? events : []).sort((a,b) =>
      String(a.created_at || a.timestamp || "").localeCompare(String(b.created_at || b.timestamp || ""))
    )
  };
}
module.exports = { buildReplay };
