// Minimal preload to ensure fetch/Request are available before any module loads.
// Used via NODE_OPTIONS=--require=./tests/jest-undici-register.js
try {
  console.log('BOOTSTRAP CHECK', {
    fetch: typeof globalThis.fetch,
    Request: typeof globalThis.Request,
    Response: typeof globalThis.Response,
    Headers: typeof globalThis.Headers,
  })
} catch (e) {}
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
    // Ensure Request is available synchronously for modules that require it at import time.
    if (typeof globalThis.Request === 'undefined') {
      if (typeof u.Request !== 'undefined') {
        globalThis.Request = u.Request;
      } else {
        // Try to use node-fetch's Request if available (it's listed in devDependencies).
        try {
          const nf = require('node-fetch');
          if (nf && typeof nf.Request !== 'undefined') {
            globalThis.Request = nf.Request;
          }
        } catch (e) {
          // As a last resort create a minimal Request constructor that delegates to undici.fetch when used.
          // This is a very small shim intended only to satisfy libraries that check for the existence
          // of `globalThis.Request` at import time. It is not a full WHATWG Request implementation.
          if (typeof globalThis.Request === 'undefined') {
            globalThis.Request = class Request {
              constructor(input, init) {
                this.url = typeof input === 'string' ? input : input && input.url;
                this.method = init && init.method ? init.method : (input && input.method) || 'GET';
                this.headers = (init && init.headers) || (input && input.headers) || {};
                this.body = init && init.body;
              }
              // minimal text() helper for very limited use-cases
              async text() {
                if (typeof globalThis.fetch === 'function') {
                  const res = await globalThis.fetch(this.url, { method: this.method, headers: this.headers, body: this.body });
                  return res.text();
                }
                return '';
              }
            };
          }
        }
      }
    }
    if (typeof globalThis.Headers === 'undefined' && typeof u.Headers !== 'undefined') {
      globalThis.Headers = u.Headers;
    }
    if (typeof globalThis.Response === 'undefined' && typeof u.Response !== 'undefined') {
      globalThis.Response = u.Response;
    }
  }
  // Polyfill Web Streams (TransformStream, ReadableStream, WritableStream) if missing.
  try {
    if (typeof globalThis.TransformStream === 'undefined' || typeof globalThis.ReadableStream === 'undefined' || typeof globalThis.WritableStream === 'undefined') {
      try {
        const streams = require('stream/web');
        if (typeof globalThis.TransformStream === 'undefined' && typeof streams.TransformStream !== 'undefined') globalThis.TransformStream = streams.TransformStream;
        if (typeof globalThis.ReadableStream === 'undefined' && typeof streams.ReadableStream !== 'undefined') globalThis.ReadableStream = streams.ReadableStream;
        if (typeof globalThis.WritableStream === 'undefined' && typeof streams.WritableStream !== 'undefined') globalThis.WritableStream = streams.WritableStream;
      } catch (e) {
        // Fall back to web-streams-polyfill if available
        try {
          const ponyfill = require('web-streams-polyfill/ponyfill');
          if (typeof globalThis.TransformStream === 'undefined' && typeof ponyfill.TransformStream !== 'undefined') globalThis.TransformStream = ponyfill.TransformStream;
          if (typeof globalThis.ReadableStream === 'undefined' && typeof ponyfill.ReadableStream !== 'undefined') globalThis.ReadableStream = ponyfill.ReadableStream;
          if (typeof globalThis.WritableStream === 'undefined' && typeof ponyfill.WritableStream !== 'undefined') globalThis.WritableStream = ponyfill.WritableStream;
        } catch (err) {
          // best-effort; leave missing if unavailable
        }
      }
    }
  } catch (err) {
    // swallow
  }
} catch (err) {
  // best-effort preload; let tests fail visibly if this doesn't work
}
