'use strict';
const { authenticate, respond, serverError } = require('../_shared/security.js');

module.exports = async function handler(req, res) {
  try {
    // Authenticate request
    const context = await authenticate(req, res);
    if (!context) return;
    const sessionId = (req.query && req.query.session_id) || (req.headers && req.headers['x-session-id']) || (req.body && req.body.session_id);
    if (!sessionId) return respond(res, 400, { ok: false, error: 'session_id required' });

    const { data, error } = await context.supabase.from('session_history').select('*').eq('session_id', sessionId).eq('user_id', context.user.id).order('created_at', { ascending: true });
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
