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
