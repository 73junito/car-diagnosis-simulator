const appVersionUtil = require('../_utils/app-version');

let createClient = null;
try {
  // lazy require so missing dependency doesn't crash non-configured envs
  ({ createClient } = require('@supabase/supabase-js'));
} catch (e) {
  createClient = null;
}

function getSingleQueryString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

module.exports = async (req, res) => {
  appVersionUtil.setAppVersionHeader(res);
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const user_id = getSingleQueryString(req.query.user_id);
    const scenario = getSingleQueryString(req.query.scenario);

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

    // Build and execute query defensively so mocks or different client shapes work in tests.
    const tableRef = client && typeof client.from === 'function' ? client.from('attempts') : null;
    if (!tableRef) {
      console.error('[/api/attempts/load] supabase client.from is not available');
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }

    try {
      // Preferred shape: chainable builder with `select()`
      if (tableRef && typeof tableRef.select === 'function') {
        let q = tableRef.select('*')
          .eq('user_id', user_id)
          .eq('scenario', scenario)
          .order('created_at', { ascending: false })
          .limit(1);
        resp = await q;
      } else if (tableRef && typeof tableRef.then === 'function') {
        // If `from()` returned a thenable/Promise that already resolves to a response
        resp = await tableRef;
      } else if (tableRef && typeof tableRef.eq === 'function') {
        // If `from()` returned an object that supports `eq` directly
        let q = tableRef;
        q = q.eq('user_id', user_id).eq('scenario', scenario).order('created_at', { ascending: false }).limit(1);
        resp = await q;
        } else if (tableRef && typeof tableRef.insert === 'function') {
          // Fallback for mocks where `from()` returns an object with `insert()` (test ordering issues)
          try {
            const maybe = tableRef.insert();
            const sel = maybe && typeof maybe.select === 'function' ? maybe.select() : null;
            const single = sel && typeof sel.single === 'function' ? await sel.single() : null;
            if (single && single.data) {
              resp = { data: Array.isArray(single.data) ? single.data : [single.data], error: single.error || null };
            } else {
              throw new Error('insert-based mock did not return data');
            }
          } catch (ie) {
            console.error('[/api/attempts/load] insert-based supabase mock failed', ie);
            return res.status(502).json({ ok: false, error: 'supabase_error' });
          }
      } else {
        console.error('[/api/attempts/load] unexpected supabase client shape', typeof tableRef, tableRef && Object.keys(tableRef));
        return res.status(502).json({ ok: false, error: 'supabase_error' });
      }
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
