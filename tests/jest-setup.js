/**
 * @file jest-setup.js
 * @description Global Jest test environment setup.
 * Defines browser APIs that jsdom does not implement.
 */

// NOTE: `fetch` and `Request` are provided by Node via NODE_OPTIONS preloading
// (undici/register). Do not re-polyfill here to avoid import-order races.
// If Node-level preload didn't run for any reason, attempt a safe runtime polyfill
// here so test files (and modules they require) see `Request`/`fetch`.
if (typeof globalThis.Request === 'undefined') {
  try {
    // Try the modern undici fetch entry
    require('undici/index-fetch');
  } catch (e1) {
    try {
      // Fallback to require the package root which may export fetch
      require('undici');
    } catch (e2) {
      try {
        // Last resort: require our local preload that mirrors undici/register
        require('./jest-undici-register.js');
      } catch (e3) {
        // swallow — we'll detect missing Request below
      }
    }
  }
}

// Ensure jsdom `window` sees the same constructors if present on Node global.
if (typeof window !== 'undefined') {
  if (typeof window.Request === 'undefined' && typeof globalThis.Request !== 'undefined') {
    window.Request = globalThis.Request;
  }
  if (typeof window.fetch === 'undefined' && typeof globalThis.fetch !== 'undefined') {
    window.fetch = globalThis.fetch;
  }
  if (typeof window.Headers === 'undefined' && typeof globalThis.Headers !== 'undefined') {
    window.Headers = globalThis.Headers;
  }
  if (typeof window.Response === 'undefined' && typeof globalThis.Response !== 'undefined') {
    window.Response = globalThis.Response;
  }
}

// -----------------------------------------------------------------------------
// matchMedia
// -----------------------------------------------------------------------------

// jsdom does not implement window.matchMedia.
// Define a minimal stub so tests using responsive hooks/components work.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// -----------------------------------------------------------------------------
// TextDecoder / TextEncoder
// -----------------------------------------------------------------------------

// Older Node runtimes used in CI may not expose these globally.
try {
   
  const { TextDecoder, TextEncoder } = require('util');

  if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextDecoder;
  }

  if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
  }
} catch (err) {
  // Best-effort polyfill; tests requiring these APIs will fail explicitly
  // if the APIs are unavailable in the runtime.
}
