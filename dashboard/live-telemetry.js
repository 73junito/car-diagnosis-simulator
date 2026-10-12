/* Legacy helper retained as a compatibility no-op.
   Live telemetry is available only from /dashboard/instructor/live-session.html,
   where canonical auth and owned-class scope are enforced. */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory)
  else if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.liveTelemetry = factory()
}(typeof self !== 'undefined' ? self : this, function () {
  function initLiveTelemetry() {
    return null
  }
  return { initLiveTelemetry }
}))
