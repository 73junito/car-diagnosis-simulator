'use strict';

// Local-only network guard for Playwright browser tests.
//
// Purpose: prevent a browser test from silently reaching a real host. Several
// application pages configure their API endpoint on a production hostname
// (for example exam-site/catalog/catalog-data.js), so a mock that stops
// matching would otherwise produce genuine production traffic.
//
// Guarantees
//  - Only explicitly approved *loopback* origins may use the network.
//  - Endpoints mocked via guard.mock() are fulfilled locally.
//  - Every other request is aborted, never forwarded.
//  - Recorded destinations are sanitized: no credentials, query string or
//    fragment, so secrets cannot leak into logs or CI output.
//
// Route precedence (verified empirically against Playwright 1.64.1)
//  - Routes are evaluated last-registered-first.
//  - So this guard MUST be installed before any mock. guard.mock() does that
//    for you. Installing the guard after a mock means the guard runs first and
//    aborts the mocked request.
//  - route.fallback() is deliberately NOT used here: with no earlier handler it
//    performs the request against the real network (observed: a real 404),
//    which would defeat the purpose of the guard.

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const DEFAULT_APPROVED_ORIGINS = ['http://127.0.0.1:3012'];
const NON_NETWORK_PROTOCOLS = new Set(['data:', 'blob:', 'about:']);
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// A path segment is treated as an identifier (and masked) when it looks like a
// UUID, a long hex string, a long opaque token, a long digit run, or embeds an
// '@' (e-mail-like / userinfo-like values).
const IDENTIFIER_SEGMENT =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,}|[A-Za-z0-9._~-]{24,}|\d{6,})$/i;

/**
 * Keep the *shape* of a path while masking identifier-like segments, so a logged
 * destination never carries a student id, attempt id, token or e-mail address.
 * Short literal segments ("api", "curriculum", "questions") are preserved for
 * diagnostics.
 * @param {string} pathname
 */
function sanitizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      if (segment.includes('@')) return ':redacted';
      return IDENTIFIER_SEGMENT.test(segment) ? ':id' : segment;
    })
    .join('/');
}

/**
 * Reduce a URL to scheme + host + sanitized path. Drops username/password, query
 * string and fragment, and masks identifier-like path segments so diagnostic logs
 * cannot carry secrets or personal identifiers.
 * @param {URL} url
 */
function sanitizeUrl(url) {
  return `${url.protocol}//${url.host}${sanitizePath(url.pathname)}`;
}

/**
 * @param {string} value
 * @returns {string} normalized origin
 */
function parseApprovedOrigin(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch (err) {
    // Deliberately does not echo the submitted value: it may carry credentials or
    // tokens, and this message reaches test output and CI logs.
    throw new Error('installLocalPreviewGuard: malformed approved origin (value not echoed)');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`installLocalPreviewGuard: approved origin must be http(s); got ${url.protocol}`);
  }
  if (!LOOPBACK_HOSTNAMES.has(url.hostname.toLowerCase())) {
    throw new Error(`installLocalPreviewGuard: approved origin must be loopback; got ${url.hostname}`);
  }
  return url.origin;
}

/**
 * Install a local-only network guard on a page.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ approvedOrigins?: string[], blockMutations?: boolean }} [options]
 *   blockMutations (default false): abort every POST/PUT/PATCH/DELETE that reaches
 *   the guard, including requests to approved loopback origins. Because mocks are
 *   registered after the guard and therefore evaluate first, a mock can still
 *   receive a mutation — a mock that must not fulfil writes should check
 *   request.method() itself.
 * @returns {Promise<{
 *   approvedOrigins: string[],
 *   blockedDestinations: string[],
 *   allowedDestinations: string[],
 *   blockedMutations: string[],
 *   mock: (pattern: string | RegExp, handler: Function) => Promise<void>,
 *   sanitizeUrl: (url: URL) => string
 * }>}
 */
async function installLocalPreviewGuard(page, options) {
  const requested = (options && options.approvedOrigins) || DEFAULT_APPROVED_ORIGINS;
  const blockMutations = Boolean(options && options.blockMutations);
  const approved = new Set(requested.map(parseApprovedOrigin));

  const blockedDestinations = [];
  const allowedDestinations = [];
  const blockedMutations = [];

  await page.route('**/*', async (route) => {
    const request = route.request();
    let url;
    try {
      url = new URL(request.url());
    } catch (err) {
      blockedDestinations.push(`unparseable-url (${request.resourceType()})`);
      return route.abort();
    }

    if (NON_NETWORK_PROTOCOLS.has(url.protocol)) return route.continue();

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      blockedDestinations.push(`${url.protocol}<blocked-protocol>`);
      return route.abort();
    }

    if (blockMutations && MUTATION_METHODS.has(request.method())) {
      blockedMutations.push(`${request.method()} ${sanitizeUrl(url)}`);
      return route.abort('blockedbyclient');
    }

    if (approved.has(url.origin)) {
      allowedDestinations.push(sanitizeUrl(url));
      return route.continue();
    }

    blockedDestinations.push(sanitizeUrl(url));
    return route.abort();
  });

  return {
    approvedOrigins: [...approved],
    blockedDestinations,
    allowedDestinations,
    blockedMutations,
    /**
     * Register a mock. Always call this after installLocalPreviewGuard() so the
     * mock is evaluated before the guard (last-registered-first).
     */
    async mock(pattern, handler) {
      await page.route(pattern, handler);
    },
    sanitizeUrl,
  };
}

module.exports = {
  installLocalPreviewGuard,
  sanitizeUrl,
  sanitizePath,
  DEFAULT_APPROVED_ORIGINS,
  LOOPBACK_HOSTNAMES,
  MUTATION_METHODS,
};
