/**
 * Browser tests for the /learning-path/ curriculum data-source transition:
 *
 *   /api/curriculum → validate schemaVersion + collections → render
 *        ↓ on API/network/contract failure
 *   fall back to the static exam-site/data/curriculum JSON
 *
 * All API traffic is intercepted with page.route() so the suite is hermetic:
 * no live backend is contacted, and both the success and failure paths are
 * exercised deterministically.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Exam-site pages use root-absolute asset paths, so playwright.config boots a
// static server rooted at exam-site/ on port 3012 for this suite.
test.use({ baseURL: 'http://127.0.0.1:3012' });

const curriculumDir = path.join(__dirname, '..', '..', 'data', 'curriculum');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(curriculumDir, name), 'utf8'));

const API_GLOB = '**/api/curriculum*';
const CORS_HEADERS = { 'access-control-allow-origin': '*' };
const EXPECTED_TOP_LEVEL_KEYS = [
  'competencies',
  'courses',
  'lessonPlans',
  'pathways',
  'schemaVersion',
  'scenarioMappings'
];
const FORBIDDEN_FIELD_TOKENS = [
  'chunk_id',
  'source_chunks',
  'evidence_role',
  'lesson_evidence',
  'question_provenance',
  'citation_validations',
  'question_citations',
  'approved_sources'
];

function buildApiPayload() {
  const pathwaysDoc = readJson('academic-pathways.json');
  return {
    schemaVersion: pathwaysDoc.schemaVersion,
    pathways: pathwaysDoc.pathways,
    courses: [
      ...readJson('undergraduate-courses.json').courses,
      ...readJson('graduate-courses.json').courses
    ],
    competencies: readJson('competencies.json').competencies,
    lessonPlans: readJson('lesson-plans.json').lessonPlans,
    scenarioMappings: readJson('scenario-mappings.json').scenarioMappings
  };
}

async function blockCdn(page) {
  // The page lazily imports mermaid from a CDN; keep the suite offline-safe.
  await page.route('**cdn.jsdelivr.net/**', (route) => route.abort('failed'));
}

async function expectCoreRendering(page) {
  await expect(page.locator('#undergraduate-content .course-grid article')).toHaveCount(4);
  await expect(page.locator('#graduate-content .graduate-grid article')).toHaveCount(5);

  const body = await page.locator('body').innerText();
  expect(body).toContain('CIP 47.0604');
  expect(body).toContain('CIP 15.0803');
  expect(body).toContain('Automotive Technology');
  expect(body).toContain('Automotive Engineering Technology');
}

async function expectOrderedLessonSequence(page, lessonPlan) {
  await page.locator(`#${lessonPlan.courseId} summary`).click();
  const rendered = await page
    .locator(`#${lessonPlan.courseId} ol.compact-sequence li`)
    .allTextContents();
  expect(rendered).toEqual(lessonPlan.sequence);
}

async function expectScholarCanonicalSourceWorkflow(page) {
  // Applied Research Scholar workflow: Google Scholar discovery →
  // resolve canonical DOI or publisher source (provenance steps stay visible).
  await page.locator('#applied-research summary').click();
  const researchText = await page.locator('#applied-research').innerText();
  expect(researchText).toContain('Search Google Scholar');
  expect(researchText).toContain('Resolve canonical DOI or publisher source');
}


test.describe('Learning path curriculum API integration', () => {
  test('renders both pathways from a validated API payload without static JSON', async ({ page }) => {
    const payload = buildApiPayload();
    let staticRequests = 0;

    await blockCdn(page);
    await page.route(API_GLOB, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(payload),
      })
    );
    await page.route('**/data/curriculum/*', (route) => {
      staticRequests += 1;
      return route.continue();
    });

    await page.goto('/learning-path/');
    await expect(page.locator('html')).toHaveAttribute('data-curriculum-source', 'api');

    await expectCoreRendering(page);
    expect(staticRequests).toBe(0);

    const electricalLesson = payload.lessonPlans.find((lesson) => lesson.courseId === 'electrical-1');
    await expectOrderedLessonSequence(page, electricalLesson);
    await expectScholarCanonicalSourceWorkflow(page);
  });

  test('falls back to static curriculum JSON when the API is unreachable', async ({ page }) => {
    let staticRequests = 0;

    await blockCdn(page);
    await page.route(API_GLOB, (route) => route.abort('failed'));
    await page.route('**/data/curriculum/*', (route) => {
      staticRequests += 1;
      return route.continue();
    });

    await page.goto('/learning-path/');
    await expect(page.locator('html')).toHaveAttribute('data-curriculum-source', 'static');

    await expectCoreRendering(page);
    expect(staticRequests).toBeGreaterThan(0);

    const electricalLesson = readJson('lesson-plans.json').lessonPlans.find(
      (lesson) => lesson.courseId === 'electrical-1'
    );
    await expectOrderedLessonSequence(page, electricalLesson);
    await expectScholarCanonicalSourceWorkflow(page);
  });

  test('falls back to static curriculum JSON when the API payload is malformed', async ({ page }) => {
    await blockCdn(page);
    await page.route(API_GLOB, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify({ schemaVersion: '0.0.1', pathways: [], courses: null }),
      })
    );

    await page.goto('/learning-path/');
    await expect(page.locator('html')).toHaveAttribute('data-curriculum-source', 'static');

    await expectCoreRendering(page);
  });

  test('API payload exposes no evidence or provenance fields', async ({ page }) => {
    const payload = buildApiPayload();

    // Exact contract shape: nothing beyond the static contract's top-level keys.
    expect(Object.keys(payload).sort()).toEqual([...EXPECTED_TOP_LEVEL_KEYS].sort());
    const serialized = JSON.stringify(payload);
    for (const token of FORBIDDEN_FIELD_TOKENS) {
      expect(serialized).not.toContain(token);
    }

    // Rendered API path must not leak provenance internals into course content.
    await blockCdn(page);
    await page.route(API_GLOB, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(payload),
      })
    );

    await page.goto('/learning-path/');
    await expect(page.locator('html')).toHaveAttribute('data-curriculum-source', 'api');

    const renderedArticles = (await page.locator('article').allInnerTexts()).join(' ');
    for (const token of FORBIDDEN_FIELD_TOKENS) {
      expect(renderedArticles).not.toContain(token);
    }
  });
});
