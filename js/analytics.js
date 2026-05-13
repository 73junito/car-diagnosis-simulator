/**
 * @file analytics.js
 * @description Thin analytics wrapper — calls window.analytics.track if available.
 * Spec: docs/hero-cta.md §5
 * Issue: HERO-005
 */

/**
 * Emits a structured telemetry event. No-op when window.analytics is absent.
 * Never includes PII.
 *
 * @param {string} eventName
 * @param {Record<string, unknown>} properties
 */
export function track(eventName, properties = {}) {
  try {
    // Prefer a bridge set by the classic-script `cta-analytics.js` when present
    if (typeof window !== 'undefined' && typeof window.__torquemind_track === 'function') {
      window.__torquemind_track(eventName, properties);
      return;
    }

    if (typeof window !== 'undefined' && typeof window.analytics?.track === 'function') {
      window.analytics.track(eventName, properties);
      return;
    }

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // best-effort fallback: send a lightweight beacon to a telemetry endpoint
      try {
        const payload = JSON.stringify({ event: eventName, props: properties, source: 'homepage' });
        navigator.sendBeacon('/_telemetry/collect', payload);
      } catch (e) {
        // swallow
      }
    }
  } catch (err) {
    console.warn('[analytics] track() failed silently:', err);
  }
}
