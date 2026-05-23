// Simple Supabase-backed telemetry storage adapter.
// Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) when present.
// Fails gracefully when not configured.

let supabase = null;
let createClient = null;
try {
  // lazy require so missing dependency doesn't crash non-configured envs
  ({ createClient } = require('@supabase/supabase-js'));
} catch (e) {
  createClient = null;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (createClient && supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

function _notConfigured() {
  return { ok: false, error: new Error('Supabase not configured'), data: null };
}

async function saveTelemetryEvent(event = {}) {
  if (!supabase) return _notConfigured();

  const row = {
    session_id: event.sessionId || null,
    user_id: event.userId || null,
    event_type: event.eventType || null,
    payload_json: event.payload || {},
    source: event.source || 'telemetry'
  };

  // supabase.from(...).insert(...) returns { data, error }
  const { data, error } = await supabase.from('telemetry_events').insert(row).select().single();
  if (error) return { ok: false, error, data: null };
  return { ok: true, data };
}

async function listTelemetryEvents({ sessionId, limit = 100 } = {}) {
  if (!supabase) return { ok: false, error: new Error('Supabase not configured'), data: [] };

  let query = supabase.from('telemetry_events').select('*').order('created_at', { ascending: false }).limit(limit);
  if (sessionId) query = query.eq('session_id', sessionId);

  const { data, error } = await query;
  if (error) return { ok: false, error, data: [] };
  return { ok: true, data };
}

module.exports = {
  saveTelemetryEvent,
  listTelemetryEvents
};
