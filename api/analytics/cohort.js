function aggregateCohort(events = []) {
  const list = Array.isArray(events) ? events : [];
  return {
    ok: true,
    totalEvents: list.length,
    uniqueStudents: new Set(list.map(e => e.userId || e.user_id).filter(Boolean)).size
  };
}
module.exports = { aggregateCohort };
