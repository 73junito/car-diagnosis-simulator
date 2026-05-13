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
