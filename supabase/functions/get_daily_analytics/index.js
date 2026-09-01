'use strict';
const { authenticate, hasPrivilegedRole, respond, serverError } = require('../_shared/security.js');

// Validate date format (YYYY-MM-DD)
function validateDateFormat(date) {
  if (!date || typeof date !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + 'T00:00:00Z');
  return !Number.isNaN(d.getTime());
}

// compute aggregates for a given date (YYYY-MM-DD)
module.exports = async function handler(req, res) {
  try {
    // Authenticate request
    const context = await authenticate(req, res);
    if (!context) return;

    // Check for privileged role
    if (!hasPrivilegedRole(context.user)) {
      return respond(res, 403, { ok: false, error: 'Access denied. Analytics requires admin or instructor role.' });
    }
    const queryDate = (req.query && req.query.date) || (req.headers && req.headers['x-date']) || null;
    const date = queryDate || new Date().toISOString().slice(0, 10);

    // Validate date format if provided
    if (queryDate && !validateDateFormat(queryDate)) {
      return respond(res, 400, { ok: false, error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // fetch telemetry events for that date
    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;

    const { data: events, error } = await context.supabase.from('telemetry_events').select('session_id, payload').gte('created_at', start).lte('created_at', end);
    if (error) {
      console.error('[get_daily_analytics] fetch error', error);
      return respond(res, 500, { ok: false, error: error.message || error });
    }

    const sessions = new Set();
    let confidenceSum = 0;
    let confidenceCount = 0;

    for (const ev of events || []) {
      if (ev.session_id) sessions.add(ev.session_id);
      const conf = ev.payload && (ev.payload.confidence || ev.payload.confidence === 0) ? Number(ev.payload.confidence) : null;
      if (typeof conf === 'number' && !Number.isNaN(conf)) { confidenceSum += conf; confidenceCount += 1; }
    }

    const avgConfidence = confidenceCount ? (confidenceSum / confidenceCount) : null;
    const totalSessions = sessions.size;

    // upsert into analytics_daily
    const upsert = { date, total_sessions: totalSessions, avg_confidence: avgConfidence, top_errors: null };
    const { error: upErr } = await context.supabase.from('analytics_daily').upsert(upsert, { onConflict: ['date'] });
    if (upErr) console.error('[get_daily_analytics] upsert error', upErr);

    return respond(res, 200, { ok: true, date, totalSessions, avgConfidence });
  } catch (err) {
    console.error('[get_daily_analytics] handler error', err);
    return respond(res, 500, { ok: false, error: err && err.message });
  }
};
