const { chromium } = require('@playwright/test');

const learningPathUrl =
  process.env.LEARNING_PATH_URL || 'https://exam.autolearnpro.com/learning-path/';

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const pageErrors = [];
    const curriculumResponses = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      if (response.url().includes('/api/curriculum')) {
        curriculumResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(learningPathUrl, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    await page.waitForFunction(
      () => Boolean(document.documentElement.dataset.curriculumSource),
      { timeout: 10_000 }
    );

    const source = await page
      .locator('html')
      .getAttribute('data-curriculum-source');

    console.log(`data-curriculum-source: ${source}`);
    console.log(`API responses: ${JSON.stringify(curriculumResponses)}`);
    console.log(`page errors: ${JSON.stringify(pageErrors)}`);

    if (source !== 'api') {
      throw new Error(
        `Expected data-curriculum-source="api", received "${source}"`
      );
    }

    if (!curriculumResponses.some((entry) => entry.startsWith('200 '))) {
      throw new Error('No successful /api/curriculum response was observed');
    }

    if (pageErrors.length > 0) {
      throw new Error(`Production page emitted page errors: ${pageErrors.join('; ')}`);
    }

    console.log('[PASS] Production learning path is rendering from the curriculum API');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exitCode = 1;
});
