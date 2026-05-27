const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const user_id = req.query.user_id || null;
    const scenario = req.query.scenario || null;

    if (!scenario) return res.status(400).json({ ok: false, error: 'validation', message: 'scenario is required' });

    const SUPABASE_URL = process.env.SUPABASE_URL || null;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(503).json({ ok: false, error: 'supabase_unavailable' });
    }

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let query = client.from('attempts').select('*');
    if (user_id) query = query.eq('user_id', user_id);
    query = query.eq('scenario', scenario).order('created_at', { ascending: false }).limit(1);

    const resp = await query;
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
