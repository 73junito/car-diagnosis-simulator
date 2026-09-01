'use strict';

const { createClient } = require('@supabase/supabase-js');

function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function configuredClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error('Server authentication is not configured.');
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function authenticate(req, res) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (typeof header !== 'string' || !/^Bearer\s+\S+$/i.test(header)) {
    respond(res, 401, { ok: false, error: 'Authentication required' });
    return null;
  }
  const supabase = configuredClient();
  const { data, error } = await supabase.auth.getUser(header.replace(/^Bearer\s+/i, ''));
  if (error || !data || !data.user || !data.user.id) {
    respond(res, 401, { ok: false, error: 'Invalid or expired authentication token' });
    return null;
  }
  return { supabase, user: data.user };
}

function hasPrivilegedRole(user) {
  const metadata = user && user.app_metadata;
  const roles = Array.isArray(metadata && metadata.roles)
    ? metadata.roles : [metadata && metadata.role];
  return roles.some((role) => role === 'admin' || role === 'instructor');
}

function serverError(res, label, error) {
  console.error(`[${label}]`, error && error.message ? error.message : 'request failed');
  respond(res, 500, { ok: false, error: 'Internal server error' });
}

module.exports = { authenticate, hasPrivilegedRole, respond, serverError };
