// Replay adapter: small helper to load telemetry events from storage
// Exposes a single function `loadEvents({sessionId, limit})` which mirrors
// the `/api/telemetry/history` shape and returns { ok, data }

const storage = require('./storage');

async function loadEvents({ sessionId = null, limit = 100 } = {}) {
  // reuse existing storage listing which returns newest-first rows
  const { ok, data, error } = await storage.listTelemetryEvents({ sessionId, limit });
  if (!ok) return { ok: false, data: [], error };
  return { ok: true, data };
}

module.exports = { loadEvents };
