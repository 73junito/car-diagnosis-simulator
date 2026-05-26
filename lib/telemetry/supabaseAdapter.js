let storage = null;
try {
  storage = require('../../api/telemetry/storage');
} catch (e) {
  storage = null;
}

async function saveEvent(event = {}) {
  if (!storage || typeof storage.saveTelemetryEvent !== 'function') return { ok: false, error: new Error('supabase_not_configured') };
  try {
    const res = await storage.saveTelemetryEvent(event);
    return res;
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function listEvents({ sessionId, limit = 50 } = {}) {
  if (!storage || typeof storage.listTelemetryEvents !== 'function') return { ok: false, error: new Error('supabase_not_configured'), data: [] };
  try {
    const res = await storage.listTelemetryEvents({ sessionId, limit });
    return res;
  } catch (err) {
    return { ok: false, error: err, data: [] };
  }
}

module.exports = {
  saveEvent,
  listEvents,
  streamEmitter: null,
  getRecentEvents: () => []
};
