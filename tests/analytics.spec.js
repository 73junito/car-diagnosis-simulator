/**
 * @file analytics.spec.js
 * @description Unit tests for js/analytics.js
 * Spec: docs/hero-cta.md §5 | Issue: HERO-005
 */

import { track } from '../js/analytics.js';

afterEach(() => {
  delete window.analytics;
  delete window.__torquemind_track;
  delete navigator.sendBeacon;
});

describe('track() — delivery surface priority', () => {
  it('calls window.__torquemind_track when present (highest priority)', () => {
    const bridge = jest.fn();
    window.__torquemind_track = bridge;
    track('hero_cta_click', { source: 'homepage' });
    expect(bridge).toHaveBeenCalledWith('hero_cta_click', { source: 'homepage' });
  });

  it('does not fall through to window.analytics when __torquemind_track is set', () => {
    const bridge = jest.fn();
    const analyticsTrack = jest.fn();
    window.__torquemind_track = bridge;
    window.analytics = { track: analyticsTrack };
    track('hero_cta_click', { source: 'homepage' });
    expect(analyticsTrack).not.toHaveBeenCalled();
  });

  it('calls window.analytics.track when present and no bridge exists', () => {
    const analyticsTrack = jest.fn();
    window.analytics = { track: analyticsTrack };
    track('hero_cta_click', { source: 'homepage' });
    expect(analyticsTrack).toHaveBeenCalledWith('hero_cta_click', { source: 'homepage' });
  });

  it('falls back to navigator.sendBeacon when window.analytics is absent', () => {
    const beacon = jest.fn();
    navigator.sendBeacon = beacon;
    track('hero_cta_click', { source: 'homepage' });
    expect(beacon).toHaveBeenCalledWith('/_telemetry/collect', expect.any(String));
  });

  it('does not throw when no analytics surface is available', () => {
    expect(() => track('hero_cta_click', { source: 'homepage' })).not.toThrow();
  });
});

describe('track() — beacon payload schema', () => {
  it('includes event name in the beacon payload', () => {
    const beacon = jest.fn();
    navigator.sendBeacon = beacon;
    track('hero_demo_load_start', { source: 'homepage', mode: 'demo-load' });
    const payload = JSON.parse(beacon.mock.calls[0][1]);
    expect(payload.event).toBe('hero_demo_load_start');
  });

  it('includes all passed properties in the beacon payload', () => {
    const beacon = jest.fn();
    navigator.sendBeacon = beacon;
    track('hero_cta_click', { source: 'homepage', mode: 'demo-load', scenarioId: 'demo-default' });
    const payload = JSON.parse(beacon.mock.calls[0][1]);
    expect(payload.props).toMatchObject({ source: 'homepage', mode: 'demo-load', scenarioId: 'demo-default' });
  });
});

describe('track() — no PII in payloads', () => {
  const PII_FIELDS = ['email', 'name', 'userId', 'ip', 'phone', 'address'];

  it('hero_cta_click payload contains no PII fields', () => {
    const analyticsTrack = jest.fn();
    window.analytics = { track: analyticsTrack };
    track('hero_cta_click', { source: 'homepage', mode: 'demo-load', scenarioId: 'demo-default' });
    const props = analyticsTrack.mock.calls[0][1];
    PII_FIELDS.forEach((field) => expect(props).not.toHaveProperty(field));
  });

  it('hero_demo_load_success payload contains no PII fields', () => {
    const analyticsTrack = jest.fn();
    window.analytics = { track: analyticsTrack };
    track('hero_demo_load_success', { source: 'homepage', mode: 'demo-load', scenarioId: 'demo-default', duration_ms: 1240 });
    const props = analyticsTrack.mock.calls[0][1];
    PII_FIELDS.forEach((field) => expect(props).not.toHaveProperty(field));
  });
});

describe('track() — all four hero events are accepted', () => {
  it.each([
    ['hero_cta_click',         { source: 'homepage', mode: 'demo-load', scenarioId: 'demo-default' }],
    ['hero_demo_load_start',   { source: 'homepage', mode: 'demo-load', scenarioId: 'demo-default' }],
    ['hero_demo_load_success', { source: 'homepage', mode: 'demo-load', scenarioId: 'demo-default', duration_ms: 1240 }],
    ['hero_demo_load_fail',    { source: 'homepage', mode: 'demo-load', scenarioId: 'demo-default', duration_ms: 10004 }],
  ])('%s does not throw', (eventName, properties) => {
    const analyticsTrack = jest.fn();
    window.analytics = { track: analyticsTrack };
    expect(() => track(eventName, properties)).not.toThrow();
    expect(analyticsTrack).toHaveBeenCalledWith(eventName, properties);
  });
});
