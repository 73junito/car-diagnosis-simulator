/*
  Simple client-side SSE consumer for live telemetry.
  Usage:
    const live = liveTelemetry.initLiveTelemetry((evt) => { console.log(evt); });
    // live.close() to stop
*/
/* global define */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.liveTelemetry = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  function initLiveTelemetry(onEvent, opts = {}) {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return null;
    const url = opts.url || '/api/telemetry/stream';
    const es = new EventSource(url);
    es.onmessage = function (e) {
      try {
        const data = JSON.parse(e.data);
        if (onEvent) onEvent(data);
      } catch (err) { void err; }
    };
    es.onerror = function () {
      // EventSource auto-reconnects; consumers can listen for visibilitychange to reattach
      void 0;
    };
    return {
      source: es,
      close() { es.close(); }
    };
  }

  return { initLiveTelemetry };
}));
