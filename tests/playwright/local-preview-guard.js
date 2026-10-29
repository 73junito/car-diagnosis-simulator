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

/**
 * Reduce a URL to scheme + host + path. Drops username/password, query string
 * and fragment so blocked-destination logs cannot carry secrets.
 * @param {URL} url
 */
function sanitizeUrl(url) {
  return `${url.protocol}//${url.host}${url.pathname}`;
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
    throw new Error(`installLocalPreviewGuard: malformed approved origin: ${JSON.stringify(value)}`);
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
 * @param {{ approvedOrigins?: string[] }} [options]
 * @returns {Promise<{
 *   approvedOrigins: string[],
 *   blockedDestinations: string[],
 *   allowedDestinations: string[],
 *   mock: (pattern: string | RegExp, handler: Function) => Promise<void>,
 *   sanitizeUrl: (url: URL) => string
 * }>}
 */
async function installLocalPreviewGuard(page, options) {
  const requested = (options && options.approvedOrigins) || DEFAULT_APPROVED_ORIGINS;
  const approved = new Set(requested.map(parseApprovedOrigin));

  const blockedDestinations = [];
  const allowedDestinations = [];

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
  DEFAULT_APPROVED_ORIGINS,
  LOOPBACK_HOSTNAMES,
};
