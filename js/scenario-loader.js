/**
 * @file scenario-loader.js
 * @description Async demo scenario loader — fetches and caches scenario config,
 *   prefetches all declared assets, and resolves with structured scenario data.
 *
 * Spec reference: docs/hero-cta.md
 *   §3a Demo-load flow   — Promise contract, timeout, error paths
 *   §4  Error & retry UX — reject behaviour, 10s timeout threshold
 *
 * Issue: HERO-003
 * Milestone: Homepage: Hero (Sprint 1)
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const SCENARIOS_CONFIG_URL = '/hero-scenarios.json';

/** @see docs/hero-cta.md §4 */
const LOAD_TIMEOUT_MS = 10_000;

// ─── Cache ────────────────────────────────────────────────────────────────────

/** @type {Record<string, ScenarioConfig> | null} */
let configPromise = null;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ScenarioConfig
 * @property {string}   id
 * @property {string}   headline
 * @property {string}   subheadline
 * @property {string}   ctaLabel
 * @property {string}   imageUrl
 * @property {string[]} [assetUrls]
 */

/**
 * @typedef {Object} ScenarioData
 * @property {string}         id
 * @property {ScenarioConfig} config
 */

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads a demo scenario: fetches config (cached), prefetches assets,
 * resolves with ScenarioData. Falls back to "demo-default" on unknown id.
 *
 * @see docs/hero-cta.md §3a, §4
 *
 * @param {string} scenarioId
 * @returns {Promise<ScenarioData>}
 *
 * @example
 * loadDemoScenario('demo-default')
 *   .then(({ id, config }) => startSimulator(config))
 *   .catch(console.error);
 */
export async function loadDemoScenario(scenarioId) {
  _log('start', scenarioId);

  const config = await _withTimeout(
    _getScenarioConfig().then((map) => {
      const cfg = map[scenarioId];
      if (cfg) {
        return cfg;
      }

      const fallbackCfg = map['demo-default'];
      if (!fallbackCfg) {
        throw new Error('[scenario-loader] "demo-default" missing from hero-scenarios.json.');
      }

      console.warn(
        `[scenario-loader] Unknown scenarioId "${scenarioId}", falling back to "demo-default".`,
      );
      return fallbackCfg;
    }),
    LOAD_TIMEOUT_MS,
    `loadDemoScenario("${scenarioId}") timed out after ${LOAD_TIMEOUT_MS}ms`,
  );

  const resolvedScenarioId = config.id || 'demo-default';

  // fire-and-forget prefetch: do not block the demo-load flow on asset prefetch
  _prefetchAssets(config);

  _log('success', resolvedScenarioId);
  return { id: resolvedScenarioId, config };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Fetches hero-scenarios.json (with caching) and returns the config for scenarioId.
 * Falls back to "demo-default" if id not found.
 *
 * @param {string} scenarioId
 * @returns {Promise<ScenarioConfig>}
 */
function _getScenarioConfig() {
  if (!configPromise) {
    configPromise = fetch(SCENARIOS_CONFIG_URL)
      .then((res) => {
        if (!res.ok) throw new Error(
          `[scenario-loader] Config fetch failed: ${res.status} ${res.statusText}`,
        );
        return res.json();
      })
      .catch((err) => {
        // Reset the promise so subsequent attempts can retry (important for tests)
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

/**
 * Prefetches all assets in the config via <link rel="prefetch">.
 * Per-asset failures are non-fatal.
 *
 * @param {ScenarioConfig} config
 * @returns {Promise<void>}
 */
function _prefetchAssets(config) {
  const urls = [config.imageUrl, ...(config.assetUrls ?? [])].filter(Boolean);
  // Non-blocking: kick off prefetches but don't await them. Each prefetch logs
  // its own failure; we don't want asset prefetch failures to reject the demo-load.
  urls.forEach((url) => {
    _prefetchUrl(url).catch((err) =>
      console.warn(`[scenario-loader] Prefetch failed "${url}":`, err),
    );
  });
}

/**
 * Injects a <link rel="prefetch"> and resolves on load / rejects on error.
 *
 * @param {string} url
 * @returns {Promise<void>}
 */
function _prefetchUrl(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) {
      return resolve();
    }
    const link = Object.assign(document.createElement('link'), {
      rel: 'prefetch', href: url,
    });
    link.addEventListener('load',  () => resolve());
    link.addEventListener('error', () => reject(new Error(`Prefetch error: ${url}`)));
    document.head.appendChild(link);
  });
}

/**
 * Races a Promise against a timeout, rejecting with a descriptive error.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} [message]
 * @returns {Promise<T>}
 */
function _withTimeout(promise, ms, message = `Timed out after ${ms}ms`) {
  return new Promise((resolve, reject) => {
    const timerId = setTimeout(() => {
      reject(new Error(`[scenario-loader] ${message}`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timerId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timerId);
        reject(error);
      },
    );
  });
}

/** @param {'start'|'success'|'fail'} event @param {string} id */
function _log(event, id) {
  console.debug(`[scenario-loader] ${event} — "${id}"`);
}

