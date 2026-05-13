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
let _configCache = null;

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
    _fetchScenarioConfig(scenarioId),
    LOAD_TIMEOUT_MS,
    `loadDemoScenario("${scenarioId}") timed out after ${LOAD_TIMEOUT_MS}ms`,
  );
  const resolvedScenarioId = config.id || 'demo-default';

  await _prefetchAssets(config);

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
async function _fetchScenarioConfig(scenarioId) {
  if (!_configCache) {
    const res = await fetch(SCENARIOS_CONFIG_URL);
    if (!res.ok) throw new Error(
      `[scenario-loader] Config fetch failed: ${res.status} ${res.statusText}`,
    );
    _configCache = await res.json();
  }

  if (_configCache[scenarioId]) return _configCache[scenarioId];

  console.warn(
    `[scenario-loader] "${scenarioId}" not found — falling back to "demo-default".`,
  );

  const fallback = _configCache['demo-default'];
  if (!fallback) throw new Error(
    '[scenario-loader] "demo-default" missing from hero-scenarios.json.',
  );
  return fallback;
}

/**
 * Prefetches all assets in the config via <link rel="prefetch">.
 * Per-asset failures are non-fatal.
 *
 * @param {ScenarioConfig} config
 * @returns {Promise<void>}
 */
async function _prefetchAssets(config) {
  const urls = [config.imageUrl, ...(config.assetUrls ?? [])].filter(Boolean);
  await Promise.allSettled(
    urls.map((url) =>
      _prefetchUrl(url).catch((err) =>
        console.warn(`[scenario-loader] Prefetch failed "${url}":`, err),
      ),
    ),
  );
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
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`[scenario-loader] ${message}`)), ms),
  );
  return Promise.race([promise, timeout]);
}

/** @param {'start'|'success'|'fail'} event @param {string} id */
function _log(event, id) {
  console.debug(`[scenario-loader] ${event} — "${id}"`);
}

