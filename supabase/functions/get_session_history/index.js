const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  try {
    const sessionId = (req.query && req.query.session_id) || (req.headers && req.headers['x-session-id']) || (req.body && req.body.session_id);
    if (!sessionId) return respond(res, 400, { ok: false, error: 'session_id required' });

    const { data, error } = await supabase.from('session_history').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
    if (error) {
      console.error('[get_session_history] fetch error', error);
      return respond(res, 500, { ok: false, error: error.message || error });
    }

    return respond(res, 200, { ok: true, session_id: sessionId, events: data || [] });
  } catch (err) {
    console.error('[get_session_history] handler error', err);
    return respond(res, 500, { ok: false, error: err && err.message });
  }
};
