// Simple Supabase-backed telemetry storage adapter.
// Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) when present.
// Fails gracefully when not configured.

let supabase = null;
let _lastConfig = { url: null, key: null };

function _getSupabase() {
  if (supabase) return supabase;

  let createClient = null;
  try {
    const mod = require('@supabase/supabase-js');
    createClient = mod && mod.createClient;
  } catch (e) {
    createClient = null;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  // If env config changed since we last created the client, reset cached client
  if (supabase && (_lastConfig.url !== supabaseUrl || _lastConfig.key !== supabaseKey)) {
    supabase = null;
  }

  if (createClient && supabaseUrl && supabaseKey) {
    if (!supabase) {
      try {
        supabase = createClient(supabaseUrl, supabaseKey);
        _lastConfig.url = supabaseUrl;
        _lastConfig.key = supabaseKey;
      } catch (err) {
        // If creating the real Supabase client fails (eg. `fetch` not defined in test env),
        // treat as not configured so tests can mock behavior without crashing.
        supabase = null;
      }
    }
  }

  return supabase;
}

function _notConfigured() {
  return { ok: false, error: new Error('Supabase not configured'), data: null };
}

async function saveTelemetryEvent(event = {}) {
  if (!_getSupabase()) return _notConfigured();

  const row = {
    session_id: event.sessionId || null,
    user_id: event.userId || null,
    event_type: event.eventType || null,
    payload_json: event.payload || {},
    source: event.source || 'telemetry'
  };

  // supabase.from(...).insert(...) returns { data, error }
  const client = _getSupabase();
  const { data, error } = await client.from('telemetry_events').insert(row).select().single();
  if (error) return { ok: false, error, data: null };
  return { ok: true, data };
}

async function listTelemetryEvents({ sessionId, limit = 100 } = {}) {
  const client = _getSupabase();
  if (!client) return { ok: false, error: new Error('Supabase not configured'), data: [] };

  let query = client.from('telemetry_events').select('*').order('created_at', { ascending: false }).limit(limit);
  if (sessionId) query = query.eq('session_id', sessionId);

  const { data, error } = await query;
  if (error) return { ok: false, error, data: [] };
  return { ok: true, data };
}

module.exports = {
  saveTelemetryEvent,
  listTelemetryEvents
};
