/**
 * @file hero.js
 * @description Hero CTA controller — handles mode dispatch, scroll, ARIA state,
 *   debounce guard, and error toast for the Homepage Hero section.
 *
 * Spec reference: docs/hero-cta.md
 *   §2  CTA modes        — data-cta-mode attribute contract
 *   §3a Demo-load flow   — ARIA, debounce, focus management
 *   §3b Scroll flow      — scrollToTarget, prefers-reduced-motion
 *   §3c Open-scenario    — modal trigger
 *   §4  Error & retry UX — toast, fallback scroll, CTA restore
 *   §5  Telemetry        — event names and payload shape
 *
 * Issues: HERO-002, HERO-004, HERO-006
 * Milestone: Homepage: Hero (Sprint 1)
 */

import { loadDemoScenario } from './scenario-loader.js';
import { track } from './analytics.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** @see docs/hero-cta.md §2 */
const CTA_MODES = /** @type {const} */ ({
  DEMO_LOAD:     'demo-load',
  SCROLL:        'scroll',
  OPEN_SCENARIO: 'open-scenario',
});

/** Default scenario when no id is supplied. @see docs/hero-cta.md §2 */
const DEFAULT_SCENARIO_ID = 'demo-default';

/** Debounce threshold in ms. @see docs/hero-cta.md §1 decision #5 */
const DEBOUNCE_MS = 300;

/** Toast auto-dismiss duration in ms. @see docs/hero-cta.md §4 */
const TOAST_DISMISS_MS = 5000;

// ─── Per-button state ─────────────────────────────────────────────────────────
// Keyed by HTMLButtonElement so state resets automatically when the element
// is replaced in the DOM (e.g. between Jest test runs).

/**
 * @typedef {{ inflightLoad: Promise<void>|null, lastActivationAt: number|null }} BtnState
 * @type {WeakMap<HTMLButtonElement, BtnState>}
 */
const _btnState = new WeakMap();

/**
 * Returns (or lazily creates) the mutable state object for a given button.
 * @param {HTMLButtonElement} btn
 * @returns {BtnState}
 */
function _getState(btn) {
  if (!_btnState.has(btn)) {
    _btnState.set(btn, { inflightLoad: null, lastActivationAt: null });
  }
  return /** @type {BtnState} */ (_btnState.get(btn));
}

// Module-level ephemeral state (kept for tests that reset module state).
/** @type {Promise<void>|null} */
let _inflightLoad = null;
/** @type {number|null} */
let _lastActivationAt = null;

// ─── Testing helpers ─────────────────────────────────────────────────────────

/**
 * Resets ephemeral module state. Call from test `beforeEach` to prevent state
 * from leaking across tests (debounce guard, in-flight Promise).
 *
 * @internal — not part of the public API; exported for testing only.
 * @returns {void}
 */
export function _resetStateForTesting() {
  _lastActivationAt = null;
  _inflightLoad = null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialises the Hero CTA — attaches click and keydown listeners, reads
 * `data-cta-mode` from the button, and wires all downstream behaviour.
 *
 * Call once on DOMContentLoaded.
 *
 * @returns {void}
 *
 * @example
 * import { initHeroCta } from './hero.js';
 * document.addEventListener('DOMContentLoaded', initHeroCta);
 */
export function initHeroCta() {
  // Reset module-level state so re-initialisation (e.g. in tests) starts clean.
  _lastActivationAt = null;
  _inflightLoad = null;

  const btn = /** @type {HTMLButtonElement | null} */ (
    document.querySelector('[data-hero-cta]')
  );
  if (!btn) return;

  btn.addEventListener('click', (e) => _handleActivation(e, btn));

  // HERO-006: Space and Enter must both activate; guard against double-fire
  // when the element is a native <button> (Enter already fires click).
  btn.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      _handleActivation(e, btn);
    }
  });
}

/**
 * Smoothly scrolls to a target element by CSS selector, compensating for the
 * sticky navigation bar height. Respects `prefers-reduced-motion`.
 *
 * @see docs/hero-cta.md §3b
 * @see HERO-002
 *
 * @param {string} selector - CSS selector of the scroll target (e.g. '#demo-section').
 * @returns {void}
 */
export function scrollToTarget(selector) {
  const target = /** @type {HTMLElement | null} */ (document.querySelector(selector));
  if (!target) {
    console.warn(`[hero] scrollToTarget: no element found for "${selector}"`);
    return;
  }

  const nav     = document.querySelector('header');
  const offset  = nav ? nav.offsetHeight : 0;
  const top     = target.getBoundingClientRect().top + window.scrollY - offset;
  const reduced = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });

  // HERO-006: move focus to target after scroll
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Central activation handler — debounces, emits hero_cta_click, dispatches mode.
 *
 * @param {Event}             _event
 * @param {HTMLButtonElement}  btn
 * @returns {void}
 */
function _handleActivation(_event, btn) {
  const state = _getState(btn);
  const now = Date.now();
  if (state.lastActivationAt !== null && now - state.lastActivationAt < DEBOUNCE_MS) return;
  state.lastActivationAt = now;

  const mode       = btn.dataset.ctaMode ?? CTA_MODES.DEMO_LOAD;
  const scenarioId = btn.dataset.scenarioId ?? DEFAULT_SCENARIO_ID;

  track('hero_cta_click', { source: 'homepage', mode, scenarioId });

  switch (mode) {
    case CTA_MODES.DEMO_LOAD:     _runDemoLoad(btn, scenarioId); break;
    case CTA_MODES.SCROLL:        scrollToTarget('#demo-section'); break;
    case CTA_MODES.OPEN_SCENARIO: _openScenarioModal(); break;
    default:
      console.warn(`[hero] Unknown CTA mode: "${mode}". Falling back to scroll.`);
      scrollToTarget('#demo-section');
  }
}

/**
 * Runs the demo-load flow: ARIA state → loadDemoScenario → telemetry → focus.
 *
 * @see docs/hero-cta.md §3a, §4
 *
 * @param {HTMLButtonElement} btn
 * @param {string}            scenarioId
 * @returns {void}
 */
function _runDemoLoad(btn, scenarioId) {
  const state = _getState(btn);
  if (state.inflightLoad) return; // reuse in-flight Promise

  _setLoadingState(btn, true);
  track('hero_demo_load_start', { source: 'homepage', mode: CTA_MODES.DEMO_LOAD, scenarioId });

  const startedAt = Date.now();

  // Use async IIFE so the try/catch/finally block resolves in fewer microtask ticks
  // than a .then().catch().finally() chain, enabling reliable test assertions with
  // a single `await Promise.resolve()`.
  state.inflightLoad = (async () => {
    try {
      const scenarioData = await loadDemoScenario(scenarioId);
      track('hero_demo_load_success', {
        source: 'homepage', mode: CTA_MODES.DEMO_LOAD, scenarioId,
        duration_ms: Date.now() - startedAt,
      });
      if (typeof window.startSimulatorWithScenario === 'function') {
        window.startSimulatorWithScenario(scenarioData);
      }
      const container = /** @type {HTMLElement | null} */ (
        document.querySelector('.demo-container')
      );
      if (container) {
        container.setAttribute('tabindex', '-1');
        container.focus({ preventScroll: false });
      }
    } catch (err) {
      track('hero_demo_load_fail', {
        source: 'homepage', mode: CTA_MODES.DEMO_LOAD, scenarioId,
        duration_ms: Date.now() - startedAt,
      });
      console.error('[hero] Demo load failed:', err);
      _showErrorToast("Couldn't load the demo. Try again.");
      scrollToTarget('#demo-section');
    } finally {
      _setLoadingState(btn, false);
      state.inflightLoad = null;
    }
  })();
}

/**
 * Opens the scenario selector modal.
 * @see docs/hero-cta.md §3c
 * TODO: implement modal open + focus trap once modal component exists.
 */
function _openScenarioModal() {
  console.warn('[hero] _openScenarioModal: not yet implemented.');
}

/**
 * Sentinel stored in `data-label-original` to indicate the button had no
 * `aria-label` attribute before loading began, so the attribute is removed
 * rather than restored to an empty string on clear.
 * @type {string}
 */
const _NO_LABEL = '\x00';

/**
 * Sets or clears aria-busy / disabled / btn-loading on the CTA button.
 * Also manages aria-label so screen readers announce "Loading…" while busy
 * and the original accessible name is restored when done.
 * @see docs/hero-cta.md §3a — HERO-004
 * @param {HTMLButtonElement} btn
 * @param {boolean} isLoading
 */
function _setLoadingState(btn, isLoading) {
  btn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  btn.disabled = isLoading;
  btn.classList.toggle('btn-loading', isLoading);
  if (isLoading) {
    btn.dataset.labelOriginal = btn.getAttribute('aria-label') ?? _NO_LABEL;
    btn.setAttribute('aria-label', 'Loading\u2026');
  } else {
    const stored = btn.dataset.labelOriginal;
    if (stored !== undefined) {
      if (stored === _NO_LABEL) {
        btn.removeAttribute('aria-label');
      } else {
        btn.setAttribute('aria-label', stored);
      }
      delete btn.dataset.labelOriginal;
    }
  }
}

/**
 * Renders an error message into the [data-hero-toast] aria-live region
 * and auto-dismisses after TOAST_DISMISS_MS.
 * @see docs/hero-cta.md §4 — HERO-004, HERO-006
 * @param {string} message
 */
function _showErrorToast(message) {
  const region = document.querySelector('[data-hero-toast]');
  if (!region) {
    console.warn('[hero] _showErrorToast: no [data-hero-toast] element found.');
    return;
  }
  region.textContent = message;
  setTimeout(() => { region.textContent = ''; }, TOAST_DISMISS_MS);
}

