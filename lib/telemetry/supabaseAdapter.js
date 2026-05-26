const EventEmitter = require('events');
let createClient;
try {
  ({ createClient } = require('@supabase/supabase-js'));
} catch (err) {
  // supabase client not installed in test/dev environment — tests will inject a client via createAdapter
  createClient = null;
}

function defaultLogger(...args) {
  if (process.env.NODE_ENV !== 'test') console.debug(...args);
}

function createAdapter(supabaseClient, opts = {}) {
  const flushIntervalMs = Number(process.env.SUPABASE_FLUSH_MS) || opts.flushIntervalMs || 2000;
  const flushSize = Number(process.env.SUPABASE_FLUSH_SIZE) || opts.flushSize || 50;
  const maxRetries = Number(process.env.SUPABASE_MAX_RETRIES) || opts.maxRetries || 3;
  const retryBaseMs = Number(process.env.SUPABASE_RETRY_BASE_MS) || opts.retryBaseMs || 100;

  const logger = opts.logger || defaultLogger;
  const emitter = new EventEmitter();

  let buffer = [];
  let timer = null;
  let closed = false;

  function scheduleFlush() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush().catch(err => logger('[supabaseAdapter] flush error', err));
    }, flushIntervalMs);
  }

  async function retryInsert(table, rows) {
    let attempt = 0;
    let lastErr = null;
    while (attempt <= maxRetries) {
      try {
        const { data, error } = await supabaseClient.from(table).insert(rows);
        if (error) throw error;
        return data;
      } catch (err) {
        lastErr = err;
        attempt += 1;
        const backoff = retryBaseMs * Math.pow(2, attempt);
        logger('[supabaseAdapter] insert failed, retry', attempt, 'backoffMs', backoff, err && err.message);
        if (attempt > maxRetries) break;
        await new Promise(r => setTimeout(r, backoff));
      }
    }
    throw lastErr;
  }

  async function sendToIngest(rows) {
    const ingestUrl = opts.ingestUrl || process.env.TELEMETRY_INGEST_URL;
    if (!ingestUrl) throw new Error('ingest url not configured');
    let attempt = 0;
    let lastErr = null;
    while (attempt <= maxRetries) {
      try {
        const res = await fetch(ingestUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: rows }),
          timeout: opts.fetchTimeoutMs || 10000,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`ingest status ${res.status} ${text}`);
        }
        const json = await res.json().catch(() => null);
        return json;
      } catch (err) {
        lastErr = err;
        attempt += 1;
        const backoff = retryBaseMs * Math.pow(2, attempt);
        logger('[supabaseAdapter] ingest failed, retry', attempt, 'backoffMs', backoff, err && err.message);
        if (attempt > maxRetries) break;
        await new Promise(r => setTimeout(r, backoff));
      }
    }
    throw lastErr;
  }

  async function flush() {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    try {
      // if ingestUrl configured, post to Edge Function instead of direct DB insert
      if (opts.ingestUrl || process.env.TELEMETRY_INGEST_URL) {
        await sendToIngest(batch);
      } else {
        // batch insert into telemetry_events
        await retryInsert('telemetry_events', batch);
      }
      logger('[supabaseAdapter] flushed', batch.length, 'events');
      emitter.emit('flush', batch.length);
    } catch (err) {
      // if insert failed, requeue the batch at front
      buffer = batch.concat(buffer);
      logger('[supabaseAdapter] flush final error', err && err.message);
      throw err;
    }
  }

  async function saveEvent(event) {
    if (closed) throw new Error('adapter closed');
    // basic validation
    if (!event || typeof event !== 'object') throw new Error('invalid event');
    if (!event.type) throw new Error('event.type required');
    // ensure timestamp
    if (!event.created_at) event.created_at = new Date().toISOString();

    buffer.push(event);
    if (buffer.length >= flushSize) {
      // trigger immediate flush
      const toFlush = timer ? (clearTimeout(timer), (timer = null), flush()) : flush();
      // don't await here
      toFlush.catch(err => logger('[supabaseAdapter] immediate flush error', err));
    } else {
      scheduleFlush();
    }
    return { ok: true };
  }

  async function recordSessionStep(step) {
    if (!step || typeof step !== 'object') throw new Error('invalid step');
    if (!step.session_id) throw new Error('step.session_id required');
    if (typeof supabaseClient.from !== 'function') throw new Error('supabase client missing');
    const payload = { session_id: step.session_id, step: step.step || 0, event: step.event || {}, created_at: step.created_at || new Date().toISOString() };
    const { data, error } = await supabaseClient.from('session_history').insert(payload);
    if (error) throw error;
    return data;
  }

  async function listEvents({ limit = 100, since } = {}) {
    let q = supabaseClient.from('telemetry_events').select('*').order('created_at', { ascending: false }).limit(limit);
    if (since) q = q.gte('created_at', since);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  function getRecentEvents() {
    return listEvents({ limit: 100 });
  }

  function close() {
    closed = true;
    if (timer) { clearTimeout(timer); timer = null; }
    return flush();
  }

  // start background flush for safety
  scheduleFlush();

  return {
    saveEvent,
    recordSessionStep,
    listEvents,
    getRecentEvents,
    flush,
    close,
    streamEmitter: emitter,
  };
}

// default adapter using env vars
let defaultAdapter = { saveEvent: async () => ({ ok: false, error: 'not configured' }), listEvents: async () => [], getRecentEvents: async () => [], streamEmitter: new EventEmitter() };
try {
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
    defaultAdapter = createAdapter(client);
  }
} catch (err) {
  // swallow — adapter will remain unconfigured
  console.error('[supabaseAdapter] init error', err && err.message);
}

module.exports = defaultAdapter;
module.exports.createAdapter = createAdapter;
