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

function createAdapter(client, opts = {}) {
  const flushIntervalMs = opts.flushIntervalMs || 1000;
  const flushSize = opts.flushSize || 10;
  const retryBaseMs = opts.retryBaseMs || 100;
  const maxRetries = opts.maxRetries || 3;

  let queue = [];
  let timer = null;

  async function doInsert(batch, attempt = 0) {
    try {
      const from = client.from('telemetry_events');
      const res = await from.insert(batch);
      if (res && res.error) {
        if (attempt < maxRetries) {
          setTimeout(() => doInsert(batch, attempt + 1), retryBaseMs * Math.pow(2, attempt));
        }
      }
    } catch (err) {
      if (attempt < maxRetries) {
        setTimeout(() => doInsert(batch, attempt + 1), retryBaseMs * Math.pow(2, attempt));
      }
    }
  }

  function flush() {
    if (!queue.length) return;
    const batch = queue.slice();
    queue = [];
    void doInsert(batch, 0);
  }

  function scheduleFlush() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, flushIntervalMs);
  }

  return {
    saveEvent: async (ev) => {
      queue.push(ev);
      if (queue.length >= flushSize) {
        setTimeout(() => flush(), 0);
      } else {
        scheduleFlush();
      }
    },
    recordSessionStep: async (row) => {
      const from = client.from('session_history');
      return from.insert(row);
    },
    close: async () => {
      if (timer) { clearTimeout(timer); timer = null; }
      flush();
    }
  };
}

module.exports.createAdapter = createAdapter;
