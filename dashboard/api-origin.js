(function initTorqueMindApi(globalObject) {
  'use strict';

  const PRODUCTION_APP_HOST = 'app.autolearnpro.com';
  const PRODUCTION_API_ORIGIN = 'https://autolearnpro.com';

  function resolveApiUrl(pathname, locationObject) {
    const location = locationObject || globalObject.location;
    const path = pathname.startsWith('/') ? pathname : `/${pathname}`;

    if (location && location.hostname === PRODUCTION_APP_HOST) {
      return `${PRODUCTION_API_ORIGIN}${path}`;
    }

    return path;
  }

  const api = { resolveApiUrl };
  globalObject.TorqueMindApi = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
