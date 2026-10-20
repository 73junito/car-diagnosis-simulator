// @ts-check
'use strict';

/**
 * Gate 2C-V real-browser worker verification.
 *
 * Loads the built solver bundle into an actual Chromium browser, starts the
 * Web Worker, and drives real solve requests through it. The expected values
 * come from the independent hand-calculated fixture.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..', '..');
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));

const values = readJson('tests/simulators/starting-system-v2-expected-values.json');
const scenarioById = (scenarioId) => values.scenarios.find((entry) => entry.scenarioId === scenarioId);

const HARNESS = '/tests/browser/simulation-worker-harness.html';
const VOLTAGE_TOLERANCE_V = 1e-4;

/** Builds the bundle so the browser test always runs current code. */
test.beforeAll(() => {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-simulation.js')], {
    cwd: root,
    stdio: 'inherit'
  });
});

test.describe.configure({ mode: 'serial' });

async function openHarness(page) {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  await page.goto(HARNESS);
  await page.waitForFunction(
    () => Boolean(window.harness && window.harness.metrics && window.harness.metrics.executionPath),
    null,
    { timeout: 60000 }
  );
  return consoleErrors;
}

function resolvedById(result) {
  return Object.fromEntries(result.quantities.map((quantity) => [quantity.measurementId, quantity.resolved]));
}

test.describe('electrical solver in a real browser worker', () => {
  test('the worker initialises and reports no runtime, CSP or bundle errors', async ({ page }) => {
    const consoleErrors = await openHarness(page);

    const errors = await page.evaluate(() => window.harness.errors);
    expect(errors).toEqual([]);

    const metrics = await page.evaluate(() => window.harness.metrics);
    expect(metrics.executionPath).toBe('worker');
    expect(metrics.firstEngine).toBe('mna-worker');
    expect(consoleErrors).toEqual([]);
  });

  test('the healthy crank solve matches the independent analytic fixture', async ({ page }) => {
    const consoleErrors = await openHarness(page);
    const result = await page.evaluate(() => window.harness.solveHealthy());

    expect(result.ok).toBe(true);
    expect(result.provenance.engine).toBe('mna-worker');
    expect(result.provenance.templateVersion).toBe('2.0.0');
    expect(result.residuals.infinityNorm).toBeLessThanOrEqual(result.residuals.tolerance);

    const expected = scenarioById('healthy-crank').testPointVoltagesV;
    const actual = resolvedById(result);
    for (const [testPointId, expectedVoltage] of Object.entries(expected)) {
      const resolved = actual[`m-${testPointId}`];
      expect(resolved.state).toBe('solved');
      expect(Math.abs(resolved.value - expectedVoltage)).toBeLessThanOrEqual(VOLTAGE_TOLERANCE_V);
    }
    expect(consoleErrors).toEqual([]);
  });

  test('every fault signature matches the independent analytic fixture', async ({ page }) => {
    await openHarness(page);

    const cases = [
      { faultIds: ['FAULT_OPEN_POWER'], scenarioId: 'open-motor-feed' },
      { faultIds: ['FAULT_OPEN_CONTROL'], scenarioId: 'open-control-circuit' },
      { faultIds: ['FAULT_OPEN_COIL'], scenarioId: 'open-solenoid-coil' }
    ];

    for (const entry of cases) {
      const result = await page.evaluate((faultIds) => window.harness.solveFaults(faultIds), entry.faultIds);
      expect({ scenarioId: entry.scenarioId, ok: result.ok }).toEqual({
        scenarioId: entry.scenarioId,
        ok: true
      });
      const expected = scenarioById(entry.scenarioId).testPointVoltagesV;
      const actual = resolvedById(result);
      for (const [testPointId, expectedVoltage] of Object.entries(expected)) {
        const resolved = actual[`m-${testPointId}`];
        expect({ scenarioId: entry.scenarioId, testPointId, state: resolved.state }).toEqual({
          scenarioId: entry.scenarioId,
          testPointId,
          state: 'solved'
        });
        expect(Math.abs(resolved.value - expectedVoltage)).toBeLessThanOrEqual(VOLTAGE_TOLERANCE_V);
      }
    }
  });

  test('an undeclared graded fault is refused in the browser too', async ({ page }) => {
    await openHarness(page);
    const result = await page.evaluate(() =>
      window.harness.solveFaults(['FAULT_HIGH_RES_POWER'])
    );
    expect(result.ok).toBe(false);
    expect(result.failure.code).toBe('TOPOLOGY_UNSUPPORTED');
    expect(result.failure.residuals).toBeNull();
  });

  test('timeout, cancellation, fallback, resource limit and disposal behave correctly', async ({ page }) => {
    await openHarness(page);

    const timeout = await page.evaluate(() => window.harness.timeoutPath());
    expect(timeout.ok).toBe(false);
    expect(timeout.failure.code).toBe('WORKER_TIMEOUT');
    expect(timeout.failure.axis).toBe('execution');
    expect(timeout.failure.residuals).toBeNull();

    const cancelled = await page.evaluate(() => window.harness.cancelPath());
    expect(cancelled.ok).toBe(false);
    expect(cancelled.failure.code).toBe('WORKER_CANCELLED');
    expect(cancelled.failure.axis).toBe('execution');

    const fallback = await page.evaluate(() => window.harness.fallbackPath());
    expect(fallback.ok).toBe(true);
    expect(fallback.provenance.engine).toBe('main-thread-fallback');

    const large = await page.evaluate(() => window.harness.largeNetworkPath());
    expect(large.ok).toBe(false);
    expect(large.failure.code).toBe('WORKER_UNAVAILABLE');
    expect(large.failure.axis).toBe('execution');

    const disposed = await page.evaluate(() => window.harness.disposePath());
    expect(disposed.ok).toBe(false);
    expect(disposed.failure.code).toBe('WORKER_UNAVAILABLE');
  });

  test('measures end-to-end latency, initialisation cost and heap use', async ({ page }) => {
    await openHarness(page);

    const metrics = await page.evaluate(() => window.harness.metrics);
    const latency = await page.evaluate(() => window.harness.measureLatency(25));


    console.log(
      `[browser-perf] init(first round trip)=${metrics.initMs.toFixed(1)} ms ` +
        `p50=${latency.p50.toFixed(2)} ms p95=${latency.p95.toFixed(2)} ms max=${latency.max.toFixed(2)} ms`
    );
    if (metrics.heapBefore && latency.heapAfter) {
      const deltaMb = (latency.heapAfter.used - metrics.heapBefore.used) / (1024 * 1024);

      console.log(`[browser-perf] js heap delta after ${latency.count} solves = ${deltaMb.toFixed(2)} MB`);
      // Chromium-only, coarse measure; the proposed budget is 25 MB incremental.
      expect(Math.abs(deltaMb)).toBeLessThan(25);
    }

    expect(latency.count).toBe(25);
    expect(latency.p95).toBeLessThan(100);
    expect(latency.max).toBeLessThan(500);
    expect(metrics.initMs).toBeLessThan(10000);
  });
});
