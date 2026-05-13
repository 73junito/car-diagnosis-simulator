/**
 * @file hero.spec.js
 * @description Unit tests for js/hero.js
 * Spec: docs/hero-cta.md §2,§3a–c,§4,§5 | Issues: HERO-002, HERO-004, HERO-006
 */

import { initHeroCta, scrollToTarget } from '../js/hero.js';

jest.mock('../js/scenario-loader.js', () => ({ loadDemoScenario: jest.fn() }));
jest.mock('../js/analytics.js',       () => ({ track: jest.fn() }));

import { loadDemoScenario } from '../js/scenario-loader.js';
import { track }            from '../js/analytics.js';

const SCENARIO_DATA = { id: 'demo-default', config: { headline: 'Test' } };

function mountHero({ mode = 'demo-load', scenarioId = 'demo-default' } = {}) {
  document.body.innerHTML = `
    <header style="height:60px"></header>
    <button data-hero-cta data-cta-mode="${mode}" data-scenario-id="${scenarioId}">CTA</button>
    <div id="demo-section" tabindex="-1"></div>
    <div class="demo-container"></div>
    <div data-hero-toast aria-live="polite"></div>`;
  initHeroCta();
  return document.querySelector('[data-hero-cta]');
}
const click = (btn) => btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const key   = (btn, k) => btn.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  loadDemoScenario.mockResolvedValue(SCENARIO_DATA);
  // jsdom does not implement matchMedia; provide a stub so spyOn works.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockReturnValue({ matches: false }),
  });
});
afterEach(() => { jest.useRealTimers(); document.body.innerHTML = ''; });

describe('initHeroCta', () => {
  it('does not throw when no [data-hero-cta] element exists', () => {
    document.body.innerHTML = '';
    expect(() => initHeroCta()).not.toThrow();
  });
});

describe('telemetry — hero_cta_click', () => {
  it('fires immediately on click before async work', () => {
    const btn = mountHero();
    loadDemoScenario.mockReturnValue(new Promise(() => {}));
    click(btn);
    expect(track).toHaveBeenCalledWith('hero_cta_click', expect.objectContaining({ source: 'homepage', mode: 'demo-load' }));
  });
  it('includes scenarioId in the payload', () => {
    const btn = mountHero({ scenarioId: 'startup' });
    loadDemoScenario.mockReturnValue(new Promise(() => {}));
    click(btn);
    expect(track).toHaveBeenCalledWith('hero_cta_click', expect.objectContaining({ scenarioId: 'startup' }));
  });
});

describe('debounce guard — 300 ms (HERO-004)', () => {
  it('calls loadDemoScenario once on 5 rapid clicks within 200 ms', () => {
    const btn = mountHero();
    for (let i = 0; i < 5; i++) { click(btn); jest.advanceTimersByTime(40); }
    expect(loadDemoScenario).toHaveBeenCalledTimes(1);
  });
  it('allows a second activation after 300 ms', async () => {
    const btn = mountHero();
    click(btn);
    await Promise.resolve();
    jest.advanceTimersByTime(301);
    click(btn);
    expect(loadDemoScenario).toHaveBeenCalledTimes(2);
  });
  it('reuses in-flight Promise — no second load while one is pending', () => {
    const btn = mountHero();
    let resolve;
    loadDemoScenario.mockReturnValue(new Promise((r) => { resolve = r; }));
    click(btn);
    jest.advanceTimersByTime(400);
    click(btn);
    expect(loadDemoScenario).toHaveBeenCalledTimes(1);
    resolve(SCENARIO_DATA);
  });
});

describe('ARIA loading state — HERO-004', () => {
  it('sets aria-busy and disabled during load', () => {
    const btn = mountHero();
    loadDemoScenario.mockReturnValue(new Promise(() => {}));
    click(btn);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.disabled).toBe(true);
    expect(btn.classList.contains('btn-loading')).toBe(true);
  });
  it('restores button state after success', async () => {
    const btn = mountHero();
    click(btn);
    await Promise.resolve(); await Promise.resolve();
    expect(btn.disabled).toBe(false);
    expect(btn.classList.contains('btn-loading')).toBe(false);
  });
  it('restores button state after failure', async () => {
    const btn = mountHero();
    loadDemoScenario.mockRejectedValue(new Error('fail'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    click(btn);
    await Promise.resolve(); await Promise.resolve();
    expect(btn.disabled).toBe(false);
  });
});

describe('telemetry — load lifecycle (HERO-005)', () => {
  it('fires hero_demo_load_start on invocation', () => {
    const btn = mountHero();
    loadDemoScenario.mockReturnValue(new Promise(() => {}));
    click(btn);
    expect(track).toHaveBeenCalledWith('hero_demo_load_start', expect.objectContaining({ source: 'homepage' }));
  });
  it('fires hero_demo_load_success with non-negative duration_ms', async () => {
    const btn = mountHero();
    click(btn);
    await Promise.resolve(); await Promise.resolve();
    const call = track.mock.calls.find(([n]) => n === 'hero_demo_load_success');
    expect(call[1].duration_ms).toBeGreaterThanOrEqual(0);
  });
  it('fires hero_demo_load_fail on rejection', async () => {
    const btn = mountHero();
    loadDemoScenario.mockRejectedValue(new Error('timeout'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    click(btn);
    await Promise.resolve(); await Promise.resolve();
    expect(track).toHaveBeenCalledWith('hero_demo_load_fail', expect.objectContaining({ scenarioId: 'demo-default' }));
  });
});

describe('keyboard accessibility — HERO-006', () => {
  it('activates on Space and prevents default page scroll', () => {
    const btn = mountHero();
    const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    jest.spyOn(e, 'preventDefault');
    btn.dispatchEvent(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(loadDemoScenario).toHaveBeenCalledTimes(1);
  });
  it('does not activate on Tab, Escape, or ArrowDown', () => {
    const btn = mountHero();
    ['Tab','Escape','ArrowDown'].forEach((k) => key(btn, k));
    expect(loadDemoScenario).not.toHaveBeenCalled();
  });
  it('moves focus to .demo-container after successful load', async () => {
    const btn = mountHero();
    const container = document.querySelector('.demo-container');
    const focusSpy  = jest.spyOn(container, 'focus');
    click(btn);
    await Promise.resolve(); await Promise.resolve();
    expect(container.getAttribute('tabindex')).toBe('-1');
    expect(focusSpy).toHaveBeenCalled();
  });
});

describe('error toast — §4', () => {
  it('populates [data-hero-toast] on load failure', async () => {
    const btn = mountHero();
    loadDemoScenario.mockRejectedValue(new Error('err'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    click(btn);
    await Promise.resolve(); await Promise.resolve();
    expect(document.querySelector('[data-hero-toast]').textContent).toMatch(/couldn't load the demo/i);
  });
  it('auto-dismisses toast after 5 000 ms', async () => {
    const btn = mountHero();
    loadDemoScenario.mockRejectedValue(new Error('err'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    click(btn);
    await Promise.resolve(); await Promise.resolve();
    jest.advanceTimersByTime(5_001);
    expect(document.querySelector('[data-hero-toast]').textContent).toBe('');
  });
});

describe('scroll mode — HERO-002', () => {
  it('calls window.scrollTo when mode is "scroll"', () => {
    const btn = mountHero({ mode: 'scroll' });
    const spy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    click(btn);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ top: expect.any(Number) }));
  });
  it('uses behavior:"auto" when prefers-reduced-motion is active', () => {
    const btn = mountHero({ mode: 'scroll' });
    jest.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    const spy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    click(btn);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });
  it('warns and does not throw when scroll target is missing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => scrollToTarget('#missing')).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('#missing'));
  });
});

describe('error fallback scroll — §4', () => {
  it('scrolls to #demo-section when loadDemoScenario rejects', async () => {
    const btn = mountHero();
    loadDemoScenario.mockRejectedValue(new Error('fail'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    click(btn);
    await Promise.resolve(); await Promise.resolve();
    expect(spy).toHaveBeenCalled();
  });
});
