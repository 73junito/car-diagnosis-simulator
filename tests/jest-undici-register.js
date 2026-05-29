// Minimal preload to ensure fetch/Request are available before any module loads.
// Used via NODE_OPTIONS=--require=./tests/jest-undici-register.js
try {
  let u;
  try {
    u = require('undici');
  } catch (e) {
    try {
      u = require('undici/index-fetch');
    } catch (err) {
      u = null;
    }
  }

  if (u) {
    if (typeof globalThis.fetch === 'undefined' && typeof u.fetch === 'function') {
      globalThis.fetch = u.fetch;
    }
    if (typeof globalThis.Request === 'undefined' && typeof u.Request !== 'undefined') {
      globalThis.Request = u.Request;
    }
    if (typeof globalThis.Headers === 'undefined' && typeof u.Headers !== 'undefined') {
      globalThis.Headers = u.Headers;
    }
    if (typeof globalThis.Response === 'undefined' && typeof u.Response !== 'undefined') {
      globalThis.Response = u.Response;
    }
  }
} catch (err) {
  // best-effort preload; let tests fail visibly if this doesn't work
}
