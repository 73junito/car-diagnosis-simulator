const { createClient } = require('@supabase/supabase-js');

// Requires these env vars to be set in the Edge Function environment:
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Basic validation helper
function validateEvent(ev) {
  if (!ev || typeof ev !== 'object') return 'event must be an object';
  if (!ev.type) return 'event.type is required';
  return null;
}

// Edge Function handler (Netlify/Node-compatible)
module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return respond(res, 405, { ok: false, error: 'Method Not Allowed' });

    const body = req.body || (req._body ? req._body : undefined);
    const payload = body || (req.headers['content-type'] && req.headers['content-type'].includes('application/json') ? await new Promise(r => { let d=''; req.on('data',c=>d+=c); req.on('end',()=>r(JSON.parse(d))); }) : null);
    if (!payload || !Array.isArray(payload.events)) return respond(res, 400, { ok: false, error: 'body must be { events: [] }' });

    const events = payload.events.map(ev => ({ ...ev, created_at: ev.created_at || new Date().toISOString() }));

    // Validate
    for (const ev of events) {
      const v = validateEvent(ev);
      if (v) return respond(res, 400, { ok: false, error: v, event: ev });
    }

    // Insert telemetry_events in a batch
    const { data: insertData, error: insertErr } = await supabase.from('telemetry_events').insert(events);
    if (insertErr) {
      console.error('[insert_telemetry_batch] insert error', insertErr);
      return respond(res, 500, { ok: false, error: insertErr.message || insertErr });
    }

    // Optionally insert session steps into session_history
    const sessionSteps = events.filter(e => e.session_id && (typeof e.step !== 'undefined'))
      .map(e => ({ session_id: e.session_id, step: e.step || 0, event: e.payload || {}, created_at: e.created_at }));

    if (sessionSteps.length > 0) {
      const { data: stepsData, error: stepsErr } = await supabase.from('session_history').insert(sessionSteps);
      if (stepsErr) console.error('[insert_telemetry_batch] session_history insert error', stepsErr);
    }

    return respond(res, 200, { ok: true, inserted: Array.isArray(insertData) ? insertData.length : 0 });
  } catch (err) {
    console.error('[insert_telemetry_batch] handler error', err);
    return respond(res, 500, { ok: false, error: err && err.message });
  }
};
