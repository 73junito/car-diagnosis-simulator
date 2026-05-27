const { setAppVersionHeader } = require('../_utils/app-version');
const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true });
const bodySchema = {
  type: 'object',
  required: ['scenario', 'workflow_type'],
  properties: {
    user_id: { type: 'string' },
    scenario: { type: 'string', minLength: 1 },
    workflow_type: { type: 'string', minLength: 1 },
    payload_json: { type: 'object' },
    score: { type: 'number' },
    completion_state: { type: 'string' },
  },
  additionalProperties: false,
};
const validateBody = ajv.compile(bodySchema);

module.exports = async (req, res) => {
  setAppVersionHeader(res);
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const body = req.body || {};
    const { user_id, scenario, workflow_type, payload_json, score, completion_state } = body;

    if (!validateBody(body)) {
      return res.status(400).json({ ok: false, error: 'validation', details: validateBody.errors });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || null;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null;
    const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      // Graceful: indicate remote persistence unavailable
      return res.status(503).json({ ok: false, error: 'supabase_unavailable' });
    }

    // Lazy-require supabase so tests don't need the package installed
    const { createClient } = require('@supabase/supabase-js');
    const client = createClient(SUPABASE_URL, SUPABASE_KEY);

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
