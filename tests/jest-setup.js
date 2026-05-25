/**
 * @file jest-setup.js
 * @description Global Jest test environment setup.
 * Defines browser APIs that jsdom does not implement.
 */

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
  // eslint-disable-next-line global-require
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
