'use strict';

// Pure policy for Playwright remote authentication setup.
//
// Remote (interactive) authentication is opt-in only: it requires
//   PLAYWRIGHT_REMOTE_AUTH=true
//   PLAYWRIGHT_REMOTE_AUTH_URL=https://<host>.autolearnpro.com
//
// There is deliberately no production default. A missing, malformed, or
// unauthorized target resolves to { allowed: false } and the setup test skips
// before any navigation occurs.
//
// This module performs no navigation, no network I/O, and reads no credentials,
// so it is safe to unit test and safe to import from the setup spec.

const ALLOWED_HOST_SUFFIX = 'autolearnpro.com';
const OPT_IN_VAR = 'PLAYWRIGHT_REMOTE_AUTH';
const TARGET_VAR = 'PLAYWRIGHT_REMOTE_AUTH_URL';

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ allowed: boolean, reason: string, url: string | null }}
 */
function resolveRemoteAuthTarget(env) {
  const source = env || process.env;

  if (source[OPT_IN_VAR] !== 'true') {
    return {
      allowed: false,
      reason: `${OPT_IN_VAR} is not "true"; remote authentication setup is disabled`,
      url: null,
    };
  }

  const raw = String(source[TARGET_VAR] || '').trim();
  if (!raw) {
    return {
      allowed: false,
      reason: `${TARGET_VAR} is required when ${OPT_IN_VAR}=true`,
      url: null,
    };
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (err) {
    // Deliberately does not echo the submitted value: it may contain credentials
    // or sensitive query parameters, and this reason reaches logs and consoles.
    return { allowed: false, reason: `malformed URL in ${TARGET_VAR}`, url: null };
  }

  // Reject embedded credentials. They are unnecessary for interactive
  // authentication and would otherwise be carried into logs, traces, and errors.
  if (parsed.username || parsed.password) {
    return {
      allowed: false,
      reason: 'remote authentication URL must not contain embedded credentials',
      url: null,
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      allowed: false,
      reason: `remote authentication requires https (got ${parsed.protocol})`,
      url: null,
    };
  }

  const host = parsed.hostname.toLowerCase();
  const hostAllowed = host === ALLOWED_HOST_SUFFIX || host.endsWith(`.${ALLOWED_HOST_SUFFIX}`);
  if (!hostAllowed) {
    return { allowed: false, reason: `unauthorized host: ${host}`, url: null };
  }

  return { allowed: true, reason: 'authorized', url: parsed.toString() };
}

module.exports = { resolveRemoteAuthTarget, ALLOWED_HOST_SUFFIX, OPT_IN_VAR, TARGET_VAR };
