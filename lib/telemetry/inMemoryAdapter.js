const { telemetryEmitter, addTelemetryEvent, getRecentEvents } = require('../../api/telemetry/events');

async function saveEvent(event = {}) {
  try {
    const ok = addTelemetryEvent(event);
    return ok ? { ok: true, data: event } : { ok: false, error: new Error('invalid_event') };
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function listEvents({ sessionId, limit = 50 } = {}) {
  try {
    // in-memory only exposes recent events; filter by sessionId if requested
    const recent = getRecentEvents() || [];
    let data = recent.slice().reverse(); // newest-first
    if (sessionId) data = data.filter(e => (e.session_id || e.session || e.sessionId) == sessionId);
    if (limit && Number.isFinite(limit)) data = data.slice(0, limit);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err, data: [] };
  }
}

module.exports = {
  saveEvent,
  listEvents,
  streamEmitter: telemetryEmitter,
  getRecentEvents,
};
