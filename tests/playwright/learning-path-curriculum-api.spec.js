/**
 * Browser tests for the /learning-path/ curriculum data-source transition:
 *
 *   /api/curriculum → validate schemaVersion + collections → render
 *        ↓ on API / HTTP / contract / timeout failure
 *   fall back to the static exam-site/data/curriculum JSON
 *
 * Hermetic by design: every /api/curriculum request is intercepted via
 * page.route(), the Mermaid CDN is blocked, and a local exam-site server
 * supplies the fallback JSON. No live backend is contacted in CI.
 *
 * NOTE ON CORS: CORS_HEADERS below is only a test affordance so the browser
 * accepts a fulfilled cross-origin response. It is deliberately permissive
 * and is NOT CORS coverage. The real allowlist is asserted in
 * tests/worker-curriculum-read.test.js.
 *
 * NOTE ON FIXTURES: the API payload is built from the same canonical
 * data/curriculum files that back the static fallback, so this suite proves
 * parity and rendering, not assembler independence. The server-side assembler
 * is covered by tests/worker-curriculum-read.test.js and
 * `npm run validate:curriculum-api` against a live endpoint.
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
// Test affordance only (see NOTE ON CORS above) — not a CORS policy assertion.
const CORS_HEADERS = { 'access-control-allow-origin': '*' };

const EXPECTED_TOP_LEVEL_KEYS = [
  'competencies',
  'courses',
  'lessonPlans',
  'pathways',
  'schemaVersion',
  'scenarioMappings'
];

// Field names the curriculum contract is allowed to expose anywhere in the
// payload. Anything else (chunk ids, provenance columns, evidence roles)
// fails the structural walk below — stronger than substring matching.
const ALLOWED_FIELD_NAMES = new Set([
  // envelope
  'schemaVersion',
  'pathways',
  'courses',
  'competencies',
  'lessonPlans',
  'scenarioMappings',
  // pathway
  'id',
  'academicLevel',
  'programId',
  'cipCode',
  'programName',
  'cipTitle',
  'status',
  // course
  'title',
  // competency
  'courseId',
  'statement',
  // lesson plan
  'competencyId',
  'sequence',
  // scenario mapping
  'scenarioId',
  'lessonPlanId'
]);

// Substring denylist retained as a second layer over rendered text.
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

/** Recursively collect every object key in a payload. */
function collectKeys(value, seen = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, seen));
    return seen;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      seen.add(key);
      collectKeys(child, seen);
    }
  }
  return seen;
}

/** Structural guarantee that no unexpected field reaches the page. */
function assertNoUnexpectedFields(payload) {
  expect(Object.keys(payload).sort()).toEqual([...EXPECTED_TOP_LEVEL_KEYS].sort());

  const unexpected = [...collectKeys(payload)].filter((key) => !ALLOWED_FIELD_NAMES.has(key));
  expect(unexpected).toEqual([]);

  const serialized = JSON.stringify(payload);
  for (const token of FORBIDDEN_FIELD_TOKENS) {
    expect(serialized).not.toContain(token);
  }
}


async function blockCdn(page) {
  // The page lazily imports mermaid from a CDN; keep the suite offline-safe.
  await page.route('**cdn.jsdelivr.net/**', (route) => route.abort('failed'));
}

/** Serve `payload` with an explicit HTTP status from /api/curriculum. */
async function mockApi(page, payload, status = 200) {
  await page.route(API_GLOB, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(payload),
    })
  );
}

/** Fail the API request at the transport layer (network/CORS-style error). */
async function mockApiNetworkFailure(page) {
  await page.route(API_GLOB, (route) => route.abort('failed'));
}

/** Never settle the API request, so only the abort/timeout path can end it. */
async function mockApiHang(page) {
  await page.route(API_GLOB, () => new Promise(() => {}));
}

/** Shorten the page's API abort budget so the timeout branch is testable. */
async function useShortApiTimeout(page, ms = 50) {
  await page.addInitScript((value) => {
    globalThis.TORQUEMIND_CURRICULUM_API_TIMEOUT_MS = value;
  }, ms);
}

/** Count static curriculum JSON reads so fallback usage is observable. */
function trackStaticReads(page) {
  const state = { count: 0 };
  page.route('**/data/curriculum/*', (route) => {
    state.count += 1;
    return route.continue();
  });
  return state;
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
  // Guard the fixture itself so a missing lesson fails with a clear message
  // instead of an undefined-access TypeError inside the helper.
  expect(lessonPlan, 'fixture must contain the expected lesson plan').toBeTruthy();
  expect(Array.isArray(lessonPlan.sequence)).toBe(true);
  expect(lessonPlan.sequence.length).toBeGreaterThan(0);

  await page.locator(`#${lessonPlan.courseId} summary`).click();
  const rendered = await page
    .locator(`#${lessonPlan.courseId} ol.compact-sequence li`)
    .allTextContents();
  expect(rendered).toEqual(lessonPlan.sequence);
}

async function expectScholarCanonicalSourceWorkflow(page) {
  // Applied Research Scholar workflow: Google Scholar discovery →
  // resolve canonical DOI or publisher source (provenance steps stay visible).
  // Coupled to user-facing copy by design: these steps are the student-visible
  // contract, so a copy change should fail this test deliberately.
  await page.locator('#applied-research summary').click();
  const researchText = await page.locator('#applied-research').innerText();
  expect(researchText).toContain('Search Google Scholar');
  expect(researchText).toContain('Resolve canonical DOI or publisher source');
}

/** Attach an uncaught-page-error collector; returns the live array. */
function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}


test.describe('Learning path curriculum API integration', () => {
  test('renders both pathways from a validated API payload without static JSON', async ({ page }) => {
    const payload = buildApiPayload();

    // API-only marker: a value that exists nowhere in the static JSON, so its
    // presence in the DOM proves the render came from the API fixture rather
    // than the fallback (or from stale client state).
    payload.pathways = payload.pathways.map((pathway) =>
      pathway.id === 'undergraduate'
        ? { ...pathway, programName: 'API Fixture Automotive Technology' }
        : pathway
    );

    const pageErrors = collectPageErrors(page);
    const staticReads = trackStaticReads(page);
    await blockCdn(page);
    await mockApi(page, payload);

    await page.goto('/learning-path/');
    await expect(page.locator('html')).toHaveAttribute('data-curriculum-source', 'api');

    // The marker proves API provenance; the real names prove contract parity.
    // Scoped to the section heading: the graduate program name also appears in
    // the page footer, which would trip Playwright strict mode.
    await expect(page.locator('#undergraduate-content h2')).toHaveText(
      'API Fixture Automotive Technology'
    );
    await expect(page.locator('#graduate-content h2')).toHaveText(
      'Automotive Engineering Technology'
    );

    await expectCoreRendering(page);
    expect(staticReads.count).toBe(0);

    const electricalLesson = payload.lessonPlans.find((lesson) => lesson.courseId === 'electrical-1');
    await expectOrderedLessonSequence(page, electricalLesson);
    await expectScholarCanonicalSourceWorkflow(page);
    expect(pageErrors).toEqual([]);
  });

  test('API payload exposes no evidence or provenance fields', async ({ page }) => {
    const payload = buildApiPayload();

    // Structural key walk (not just substring matching) + token denylist.
    assertNoUnexpectedFields(payload);

    const pageErrors = collectPageErrors(page);
    await blockCdn(page);
    await mockApi(page, payload);

    await page.goto('/learning-path/');
    await expect(page.locator('html')).toHaveAttribute('data-curriculum-source', 'api');

    const renderedArticles = (await page.locator('article').allInnerTexts()).join(' ');
    for (const token of FORBIDDEN_FIELD_TOKENS) {
      expect(renderedArticles).not.toContain(token);
    }
    expect(pageErrors).toEqual([]);
  });

  test('falls back to static curriculum JSON when the API is unreachable', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    const staticReads = trackStaticReads(page);
    await blockCdn(page);
    await mockApiNetworkFailure(page);

    await page.goto('/learning-path/');
    await expect(page.locator('html')).toHaveAttribute('data-curriculum-source', 'static');

    await expectCoreRendering(page);
    expect(staticReads.count).toBeGreaterThan(0);

    const electricalLesson = readJson('lesson-plans.json').lessonPlans.find(
      (lesson) => lesson.courseId === 'electrical-1'
    );
    await expectOrderedLessonSequence(page, electricalLesson);
    await expectScholarCanonicalSourceWorkflow(page);
    expect(pageErrors).toEqual([]);
  });

  test('falls back to static curriculum JSON when the API returns HTTP 500', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    const staticReads = trackStaticReads(page);
    await blockCdn(page);
    // Body is a VALID contract payload, so the only thing that can trigger the
    // fallback is the !response.ok status check in loadFromApi().
    await mockApi(page, buildApiPayload(), 500);

    await page.goto('/learning-path/');
    await expect(page.locator('html')).toHaveAttribute('data-curriculum-source', 'static');

    await expectCoreRendering(page);
    expect(staticReads.count).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  test('falls back to static curriculum JSON when the API request times out', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    const staticReads = trackStaticReads(page);
    await blockCdn(page);
    await useShortApiTimeout(page);
    await mockApiHang(page);

    await page.goto('/learning-path/');
    await expect(page.locator('html')).toHaveAttribute('data-curriculum-source', 'static');

    await expectCoreRendering(page);
    expect(staticReads.count).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });


  // One case per validator branch in validateApiPayload(), so a failure
  // identifies which contract rule broke instead of "some bad payload".
  const contractFailures = [
    {
      name: 'unsupported schemaVersion',
      build: (base) => ({ ...base, schemaVersion: '0.0.1' }),
    },
    {
      name: 'a non-object payload',
      build: () => 'not-an-object',
    },
    {
      name: 'a missing lessonPlans collection',
      build: (base) => {
        const payload = { ...base };
        delete payload.lessonPlans;
        return payload;
      },
    },
    {
      name: 'a non-array competencies collection',
      build: (base) => ({ ...base, competencies: null }),
    },
    {
      name: 'a missing undergraduate pathway',
      build: (base) => ({
        ...base,
        pathways: base.pathways.filter((item) => item.academicLevel !== 'undergraduate'),
      }),
    },
    {
      name: 'a missing graduate pathway',
      build: (base) => ({
        ...base,
        pathways: base.pathways.filter((item) => item.academicLevel !== 'graduate'),
      }),
    },
  ];

  for (const failure of contractFailures) {
    test(`falls back to static curriculum JSON for ${failure.name}`, async ({ page }) => {
      const pageErrors = collectPageErrors(page);
      const staticReads = trackStaticReads(page);
      await blockCdn(page);
      await mockApi(page, failure.build(buildApiPayload()));

      await page.goto('/learning-path/');
      await expect(page.locator('html')).toHaveAttribute('data-curriculum-source', 'static');
      await expectCoreRendering(page);
      expect(staticReads.count).toBeGreaterThan(0);
      expect(pageErrors).toEqual([]);
    });
  }
});
