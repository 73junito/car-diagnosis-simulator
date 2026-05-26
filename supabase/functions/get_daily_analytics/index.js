const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// compute aggregates for a given date (YYYY-MM-DD)
module.exports = async function handler(req, res) {
  try {
    const queryDate = (req.query && req.query.date) || (req.headers && req.headers['x-date']) || null;
    const date = queryDate || new Date().toISOString().slice(0, 10);

    // fetch telemetry events for that date
    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;

    const { data: events, error } = await supabase.from('telemetry_events').select('session_id, payload').gte('created_at', start).lte('created_at', end);
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
    const { error: upErr } = await supabase.from('analytics_daily').upsert(upsert, { onConflict: ['date'] });
    if (upErr) console.error('[get_daily_analytics] upsert error', upErr);

    return respond(res, 200, { ok: true, date, totalSessions, avgConfidence });
  } catch (err) {
    console.error('[get_daily_analytics] handler error', err);
    return respond(res, 500, { ok: false, error: err && err.message });
  }
};
