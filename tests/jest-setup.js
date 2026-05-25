/**
 * @file jest-setup.js
 * @description Global Jest test environment setup.
 * Defines browser APIs that jsdom does not implement.
 */

// jsdom does not implement window.matchMedia; define a no-op stub so that
// jest.spyOn(window, 'matchMedia') works in tests (HERO-006).
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = function matchMedia(_query) {
    return {
      matches:             false,
      media:               _query,
      onchange:            null,
      addListener:         function () {},
      removeListener:      function () {},
      addEventListener:    function () {},
      removeEventListener: function () {},
      dispatchEvent:       function () { return false; },
    };
  };
}

// Node (older runtimes used in some CI images) may not have TextDecoder
// globally available. Provide a lightweight polyfill using the Node
// `util` module so modules that import or use `TextDecoder` during
// module initialization (for example in `express` dependencies) do not
// throw during test collection.
if (typeof global.TextDecoder === 'undefined') {
  try {
    // eslint-disable-next-line global-require
    const { TextDecoder } = require('util');
    global.TextDecoder = TextDecoder;
  } catch (e) {
    // best-effort polyfill; if unavailable leave it undefined and tests
    // that require it will fail explicitly.
  }
}

// Some dependencies expect a global TextEncoder (web API). Provide a
// lightweight polyfill using Node's `util` where available to avoid
// errors during module initialization in tests.
if (typeof global.TextEncoder === 'undefined') {
  try {
    // eslint-disable-next-line global-require
    const { TextEncoder } = require('util');
    global.TextEncoder = TextEncoder;
  } catch (e) {
    // best-effort; if not available, tests will surface the missing API.
  }
}
