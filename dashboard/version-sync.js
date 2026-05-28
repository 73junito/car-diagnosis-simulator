// Browser-only, side-effect-free version sync utility.
// Usage:
// const vs = createVersionSync({ url: '/version.json', interval: 60_000 });
// vs.start(); // returns stop() function on the instance

function isBrowser() {
  return typeof window !== 'undefined' && typeof fetch === 'function';
}

function defaultOnStale(remoteVersion) {
  try {
    if (isBrowser() && window.localStorage) {
      window.localStorage.setItem('__version_reload_request', Date.now().toString());
    }
  } catch (e) {
    // ignore storage errors
  }
}

function createVersionSync({ url = '/version.json', interval = 60000, onStale = defaultOnStale } = {}) {
  if (!isBrowser()) {
    // Provide a no-op interface for non-browser environments (build, tests, server)
    return {
      start() { return () => {}; },
      stop() {},
      checkNow: async () => null,
    };
  }

  let timer = null;
  let lastKnown = null;

  async function fetchVersion() {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res || !res.ok) return null;
      const data = await res.json();
      return data && data.version ? data.version : null;
    } catch (err) {
      return null;
    }
  }

  async function checkNow() {
    const v = await fetchVersion();
    if (!v) return null;
    if (lastKnown && lastKnown !== v) {
      try { onStale(v); } catch (e) { /* swallow */ }
    }
    lastKnown = v;
    return v;
  }

  function start() {
    // initial check
    checkNow();
    timer = setInterval(checkNow, interval);
    return () => stop();
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { start, stop, checkNow };
}

module.exports = { createVersionSync };

// Convenience standalone helper used by tests and simple pages
async function checkVersion() {
  const vs = createVersionSync();
  try {
    const v = await vs.checkNow();
    if (typeof window === 'undefined') return v;
    try {
      const prev = window.APP_VERSION;
      if (v && prev && prev !== v) {
        // create a simple reload banner so UI can prompt user
        try {
          let banner = document.getElementById('version-sync-banner');
          if (!banner) {
            banner = document.createElement('div');
            banner.id = 'version-sync-banner';
            banner.textContent = 'A new version is available — please reload.';
            document.body.appendChild(banner);
          }
        } catch (e) { /* ignore DOM errors */ }
      }
      if (v) window.APP_VERSION = v;
    } catch (e) { /* ignore */ }
    return v;
  } catch (e) {
    return null;
  }
}

module.exports = { createVersionSync, checkVersion };
