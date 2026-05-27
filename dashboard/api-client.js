/* eslint-disable no-empty, no-unused-vars */
// Simple fetch wrapper to detect API `x-app-version` mismatches.
// Usage: require('./api-client').initApiClient({ onStale })

function getClientVersion() {
  try {
    return (typeof window !== 'undefined' && (window.APP_VERSION || window.localStorage && window.localStorage.getItem('app_version'))) || null;
  } catch (e) {
    // swallow errors accessing window/localStorage in test envs
    return null;
  }
}

function defaultOnStale(serverVersion, info = {}) {
  try {
    // Broadcast reload request to other tabs; version-sync will pick this up
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('__version_reload_request', Date.now().toString());
    }
  } catch (e) {
    // ignore localStorage errors
  }
}

function initApiClient({ onStale = defaultOnStale, retryOnce = true } = {}) {
  if (typeof window === 'undefined' || !window.fetch) return;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function(input, init) {
    const resp = await originalFetch(input, init);
    try {
      const serverVersion = resp && resp.headers && typeof resp.headers.get === 'function' ? resp.headers.get('x-app-version') : null;
      if (!serverVersion) return resp;

      const clientVersion = getClientVersion();
      if (clientVersion && serverVersion !== clientVersion) {
        // signal stale
        onStale && onStale(serverVersion, { input, init });

        if (retryOnce) {
          // attempt one retry
          const retryResp = await originalFetch(input, init);
          const retryServerVersion = retryResp && retryResp.headers && typeof retryResp.headers.get === 'function' ? retryResp.headers.get('x-app-version') : null;
          if (retryServerVersion && retryServerVersion === clientVersion) {
            return retryResp;
          }
          // still stale -> notify with forceReload hint
          onStale && onStale(serverVersion, { input, init, forceReload: true });
          return retryResp;
        }
      }
    } catch (e) {
      // ignore header parsing errors
    }
    return resp;
  };
}

module.exports = { initApiClient };
