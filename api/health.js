// Lightweight health endpoint for system-state checks
// Returns which downstream services are configured so CI and harness can preflight.
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const present = v => (v ? 'configured' : 'missing');
  const env = {
    supabase: present(process.env.SUPABASE_URL && process.env.SUPABASE_KEY),
    admin: present(process.env.ADMIN_TOKEN),
    resend: present(process.env.RESEND_API_KEY),
    sendgrid: present(process.env.SENDGRID_API_KEY),
    site_url: present(process.env.SITE_URL)
  };

  // Deployment metadata to help distinguish local vs preview/prod
  const deployment = {
    region: process.env.CLOUDFLARE_REGION || 'local',
    environment: process.env.TORQUEMIND_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
    url: process.env.SITE_URL || null,
    commit: process.env.GITHUB_SHA || process.env.GIT_COMMIT || process.env.APP_VERSION || null
  };

  return res.status(200).json({ ok: true, time: new Date().toISOString(), env, deployment });
};
