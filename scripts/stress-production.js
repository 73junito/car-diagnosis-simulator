const { chromium } = require('@playwright/test');
const { performance } = require('node:perf_hooks');

const BASE_URL = (
  process.env.BASE_URL ||
  'https://car-diagnosis-simulator.vercel.app'
).replace(/\/+$/, '');

const ROUTES = [
  '/',
  '/dashboard/student',
  '/dashboard/analytics',
  '/dashboard/instructor/analytics.html',
  '/dashboard/live-session',
  '/dashboard/session-history',
  '/dashboard/instructor/session-history.html',
  '/docs'
];

const ITERATIONS = 10;
const CONCURRENCY = 4;

async function inspectPage(browser, route, iteration) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: false
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      failure:
        request.failure()?.errorText || 'Unknown failure'
    });
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      badResponses.push({
        status: response.status(),
        url: response.url()
      });
    }
  });

  const url = `${BASE_URL}${route}`;
  const started = performance.now();

  let status = null;
  let finalUrl = null;
  let title = null;
  let bodyText = '';
  let navigationError = null;

  try {
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 45000
    });

    status = response?.status() ?? null;
    finalUrl = page.url();
    title = await page.title();
    bodyText = await page.locator('body').innerText();
  } catch (error) {
    navigationError = error.message;
  }

  const elapsedMs = Math.round(
    performance.now() - started
  );

  await context.close();

  return {
    route,
    iteration,
    status,
    finalUrl,
    title,
    elapsedMs,
    navigationError,
    consoleErrors,
    pageErrors,
    failedRequests,
    badResponses,
    indicators: {
      scenarioCountMismatch:
        bodyText.includes('17 Total available') &&
        bodyText.includes('Showing 0 of 0 scenarios'),

      loadingStatePresent:
        bodyText.includes('Loading…') ||
        bodyText.includes('Loading ASE readiness'),

      serverError:
        /\b(500|502|503|504)\b/.test(bodyText),

      notFound:
        bodyText.includes('404') ||
        bodyText.includes('Page Not Found')
    }
  };
}

async function runPool(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const taskIndex = index++;
      results[taskIndex] = await tasks[taskIndex]();
    }
  }

  await Promise.all(
    Array.from(
      { length: concurrency },
      () => worker()
    )
  );

  return results;
}

async function main() {
  const browser = await chromium.launch({
    headless: true
  });

  try {
    const tasks = [];

    for (
      let iteration = 1;
      iteration <= ITERATIONS;
      iteration += 1
    ) {
      for (const route of ROUTES) {
        tasks.push(() =>
          inspectPage(browser, route, iteration)
        );
      }
    }

    const results = await runPool(
      tasks,
      CONCURRENCY
    );

    const failures = results.filter((result) =>
      result.navigationError ||
      result.status === null ||
      result.status >= 400 ||
      result.consoleErrors.length ||
      result.pageErrors.length ||
      result.failedRequests.length ||
      result.badResponses.length ||
      result.indicators.serverError ||
      result.indicators.notFound
    );

    const timingsByRoute = {};

    for (const route of ROUTES) {
      const timings = results
        .filter((result) => result.route === route)
        .map((result) => result.elapsedMs)
        .sort((a, b) => a - b);

      const percentile = (p) => {
        const index = Math.min(
          timings.length - 1,
          Math.ceil(timings.length * p) - 1
        );

        return timings[index];
      };

      timingsByRoute[route] = {
        requests: timings.length,
        minimumMs: timings[0],
        medianMs: percentile(0.5),
        p95Ms: percentile(0.95),
        maximumMs: timings[timings.length - 1]
      };
    }

    console.log('\nTiming summary:');
    console.table(timingsByRoute);

    console.log(
      '\nScenario count mismatches:',
      results.filter(
        (result) =>
          result.indicators.scenarioCountMismatch
      ).length
    );

    console.log(
      'Persistent loading states:',
      results.filter(
        (result) =>
          result.indicators.loadingStatePresent
      ).length
    );

    console.log(
      'Hard failures:',
      failures.length
    );

    if (failures.length) {
      console.dir(failures, {
        depth: null
      });

      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
