// Telemetry facade selects an adapter based on environment/configuration
const inMemory = require('./inMemoryAdapter');
const supabase = require('./supabaseAdapter');

let adapter = inMemory;
// prefer supabase when configured
if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
  // if supabaseAdapter is available and reports list/save functions, use it
  if (supabase && typeof supabase.listEvents === 'function' && typeof supabase.saveEvent === 'function') {
    adapter = supabase;
  }
}

module.exports = {
  saveEvent: adapter.saveEvent,
  listEvents: adapter.listEvents,
  streamEmitter: adapter.streamEmitter,
  getRecentEvents: adapter.getRecentEvents,
};
