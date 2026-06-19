const appVersionUtil = require('../_utils/app-version');

let createClient = null;
try {
  // lazy require so missing dependency doesn't crash non-configured envs
  ({ createClient } = require('@supabase/supabase-js'));
} catch (e) {
  createClient = null;
}

module.exports = async (req, res) => {
  appVersionUtil.setAppVersionHeader(res);
  // debug logging removed
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const user_id = req.query.user_id || null;
    const scenario = req.query.scenario || null;

    if (!user_id) return res.status(400).json({ ok: false, error: 'validation', message: 'user_id is required' });
    if (!scenario) return res.status(400).json({ ok: false, error: 'validation', message: 'scenario is required' });

    const SUPABASE_URL = process.env.SUPABASE_URL || null;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
    if (!createClient || !SUPABASE_URL || !(SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)) {
      return res.status(503).json({ ok: false, error: 'supabase_unavailable' });
    }

    // Create supabase client using the available factory
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
    let resp = null;

    // Execute the query using the standard Supabase query-builder shape.
    const tableRef = client && typeof client.from === 'function' ? client.from('attempts') : null;
    if (!tableRef) {
      console.error('[/api/attempts/load] supabase client.from is not available');
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }

    let query = null;
    try {
      query = typeof tableRef.select === 'function' ? tableRef.select('*') : null;
    } catch (e) {
      console.error('[/api/attempts/load] supabase select init failure', e);
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }

    if (!query || typeof query.eq !== 'function') {
      console.error('[/api/attempts/load] unexpected supabase query shape', query && Object.keys(query));
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }

    try {
      resp = await query
        .eq('user_id', user_id)
        .eq('scenario', scenario)
        .order('created_at', { ascending: false })
        .limit(1);
    } catch (e) {
      console.error('[/api/attempts/load] supabase query failure', e);
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }
    if (resp.error) {
      console.error('[/api/attempts/load] supabase select error', resp.error);
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }

    const row = Array.isArray(resp.data) && resp.data.length ? resp.data[0] : null;
    return res.status(200).json({ ok: true, attempt: row });
  } catch (err) {
    console.error('[/api/attempts/load] unexpected error', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
};
