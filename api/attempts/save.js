const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const body = req.body || {};
    const { user_id, scenario, workflow_type, payload_json, score, completion_state } = body;

    if (!scenario || !workflow_type) {
      return res.status(400).json({ ok: false, error: 'validation', message: 'scenario and workflow_type are required' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || null;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      // Graceful: indicate remote persistence unavailable
      return res.status(503).json({ ok: false, error: 'supabase_unavailable' });
    }

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Insert attempt record
    const payload = {
      user_id: user_id || null,
      scenario,
      workflow_type,
      payload_json: payload_json || null,
      score: typeof score === 'number' ? score : null,
      completion_state: completion_state || null,
    };

    const resp = await client.from('attempts').insert([payload]).select('id').single();
    if (resp.error) {
      console.error('[/api/attempts/save] supabase insert error', resp.error);
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }

    const id = resp.data && resp.data.id ? resp.data.id : null;
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error('[/api/attempts/save] unexpected error', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
};
