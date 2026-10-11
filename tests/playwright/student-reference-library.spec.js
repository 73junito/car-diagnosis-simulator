/**
 * Browser + accessibility checks for the student Reference Library
 * (dashboard/student/reference-library/).
 *
 * Hermetic by design: /api/curriculum and /api/curriculum/references are
 * intercepted with page.route() and served from inline fixtures. No live
 * backend is contacted. CORS headers below are a test affordance only (see the
 * learning-path-curriculum-api suite) — the real allowlist is asserted in
 * tests/worker-curriculum-read.test.js.
 *
 * SCOPE OF AUTOMATION: this suite proves repeatable behavior — data states,
 * filtering, detail/rights rendering, keyboard/focus management, and responsive
 * structure. It does NOT measure WCAG 2.2 AA contrast ratios and does not run an
 * axe scan (no axe dependency is installed in this repo). Contrast and an axe
 * pass remain manual Stage-4 items; assertions here deliberately avoid brittle
 * exact-pixel measurements.
 */
const { test, expect } = require('@playwright/test');

const PAGE_PATH = '/dashboard/student/reference-library/';
const CURRICULUM_GLOB = '**/api/curriculum';
const REFERENCES_GLOB = '**/api/curriculum/references**';
// Test affordance only — not a CORS policy assertion.
const CORS_HEADERS = { 'access-control-allow-origin': '*' };

const CURRICULUM_PAYLOAD = {
  schemaVersion: '1.0.0',
  pathways: [],
  courses: [],
  catalogCourses: [],
  competencies: [],
  lessonPlans: [
    { id: 'ug-electrical-charging-system', title: 'Charging-System Evidence and Diagnostic Decisions' },
    { id: 'ug-aut360-data-analysis', title: 'Vehicle Data Acquisition, Visualization, and Interpretation' }
  ],
  scenarioMappings: []
};

// Representative rights combinations + missing optional metadata (no publisher,
// no canonicalUrl) so graceful degradation is exercised.
const REFERENCES_PAYLOAD = {
  data: [
    {
      id: 'technical-writing-for-technicians-2019',
      title: 'Technical Writing for Technicians',
      publisher: 'Linn-Benton Community College / Open Oregon',
      publicationYear: 2019,
      subjectArea: 'technical communication',
      sourceKind: 'oer-textbook',
      canonicalUrl: 'https://openoregon.pressbooks.pub/ctetechwriting/',
      licenseClassification: 'CC_BY_4_0',
      rights: {
        citationLinkAllowed: true,
        paraphraseSummaryAllowed: true,
        directReproductionAllowed: true,
        databaseStorageAllowed: true,
        aiRagIngestionAllowed: true,
        commercialUseAllowed: true,
        attributionRequired: true,
        shareAlikeRequired: false
      }
    },
    {
      id: 'openstax-university-physics-v1-2026',
      title: 'University Physics Volume 1',
      publisher: 'OpenStax',
      publicationYear: 2026,
      subjectArea: 'physics',
      sourceKind: 'technical-reference',
      canonicalUrl: 'https://openstax.org/',
      licenseClassification: 'CC_BY_NC_SA_4_0',
      rights: {
        citationLinkAllowed: true,
        paraphraseSummaryAllowed: true,
        directReproductionAllowed: false,
        databaseStorageAllowed: false,
        aiRagIngestionAllowed: false,
        commercialUseAllowed: false,
        attributionRequired: true,
        shareAlikeRequired: true
      }
    },
    {
      id: 'nhtsa-electric-hybrid-vehicle-safety-2026',
      title: null, // exercise title fallback to id
      publisher: null, // missing optional metadata
      publicationYear: null,
      subjectArea: 'safety',
      sourceKind: 'technical-reference',
      canonicalUrl: null, // no link rendered
      licenseClassification: 'PUBLIC_DOMAIN_US_GOV',
      rights: {
        citationLinkAllowed: true,
        paraphraseSummaryAllowed: true,
        directReproductionAllowed: false,
        databaseStorageAllowed: true,
        aiRagIngestionAllowed: false,
        commercialUseAllowed: true,
        attributionRequired: false,
        shareAlikeRequired: false
      }
    }
  ],
  mappings: [
    {
      reference_id: 'technical-writing-for-technicians-2019',
      lesson_plan_id: 'ug-electrical-charging-system',
      role: 'technical-communication',
      notes: 'Supports technician-facing documentation.'
    },
    {
      reference_id: 'openstax-university-physics-v1-2026',
      lesson_plan_id: 'ug-aut360-data-analysis',
      role: 'stem-foundation',
      notes: 'Reference-only physics foundation.'
    }
  ]
};

function fulfill(route, payload, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(payload)
  });
}

async function mockSuccess(page, references = REFERENCES_PAYLOAD) {
  await page.route(CURRICULUM_GLOB, (route) => fulfill(route, CURRICULUM_PAYLOAD));
  await page.route(REFERENCES_GLOB, (route) => fulfill(route, references));
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.describe('student reference library — browser & accessibility', () => {

  test.beforeEach(async ({ page }) => {
    await mockSuccess(page);
  });

  test('renders the three-panel interface and populated results', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.goto(PAGE_PATH);

    await expect(page.getByRole('heading', { name: 'Reference Library', level: 1 })).toBeVisible();
    await expect(page.locator('#refSearch')).toBeVisible();
    await expect(page.locator('#refResults')).toBeVisible();
    await expect(page.locator('#refDetail')).toBeVisible();

    // Three governed sources render as selectable result buttons.
    const results = page.locator('#refResults .ref-result');
    await expect(results).toHaveCount(3);
    await expect(page.locator('#refStatus')).toContainText('Showing 3 governed supplemental references.');
    expect(pageErrors).toEqual([]);
  });

  test('shows loading then results, and never renders undefined for missing metadata', async ({ page }) => {
    await page.goto(PAGE_PATH);
    // Results appear; the source with null title/publisher falls back to id and
    // omits the meta line rather than printing "null"/"undefined".
    await expect(page.locator('#refResults .ref-result')).toHaveCount(3);
    const nhtsa = page.locator('#refResults .ref-result', { hasText: 'nhtsa-electric-hybrid-vehicle-safety-2026' });
    await expect(nhtsa).toBeVisible();
    await expect(page.locator('#refResults')).not.toContainText('undefined');
    await expect(page.locator('#refResults')).not.toContainText('null');
  });

  test('shows the empty-catalog state when nothing is mapped', async ({ page }) => {
    await mockSuccess(page, { data: [], mappings: [] });
    await page.goto(PAGE_PATH);
    await expect(page.locator('#refStatus')).toHaveText('No supplemental references are mapped yet.');
    await expect(page.locator('#refResults .ref-result')).toHaveCount(0);
  });

  test('shows an error state with retry on request failure', async ({ page }) => {
    // Network-level failure: the browser's fetch throws a native TypeError
    // ("Failed to fetch"), which the page surfaces verbatim in the alert region.
    await page.route(REFERENCES_GLOB, (route) => route.abort('failed'));
    await page.goto(PAGE_PATH);
    await expect(page.locator('#refError')).toBeVisible();
    await expect(page.locator('#refErrorText')).not.toHaveText('');

    // Recover: retry re-fetches and now succeeds.
    await mockSuccess(page);
    await page.locator('#refRetry').click();
    await expect(page.locator('#refResults .ref-result')).toHaveCount(3);
    await expect(page.locator('#refError')).toBeHidden();
  });

  test('shows the app error message when the API returns HTTP 500', async ({ page }) => {
    await page.route(REFERENCES_GLOB, (route) => fulfill(route, { error: 'boom' }, 500));
    await page.goto(PAGE_PATH);
    await expect(page.locator('#refErrorText')).toContainText('Reference services are unavailable.');
    await expect(page.locator('#refRetry')).toBeVisible();
  });

  test('combined search + facet filtering narrows results; clearing restores them', async ({ page }) => {
    await page.goto(PAGE_PATH);
    await expect(page.locator('#refResults .ref-result')).toHaveCount(3);

    // Search narrows to one source.
    await page.locator('#refSearch').fill('physics');
    await expect(page.locator('#refResults .ref-result')).toHaveCount(1);
    await expect(page.locator('#refStatus')).toContainText('Showing 1 governed supplemental reference.');

    // Clearing search restores all three.
    await page.locator('#refClearFilters').click();
    await expect(page.locator('#refResults .ref-result')).toHaveCount(3);

    // Facet filter (source type) narrows; two oer/technical references remain.
    await page.locator('#refSearch').fill('');
    const subjectFacet = page.locator('#refSubjectFacets input[value="physics"]');
    await subjectFacet.check();
    await expect(page.locator('#refResults .ref-result')).toHaveCount(1);
    await page.locator('#refClearFilters').click();
    await expect(page.locator('#refResults .ref-result')).toHaveCount(3);
  });

  test('a filter that matches nothing shows the filtered-empty state', async ({ page }) => {
    await page.goto(PAGE_PATH);
    await page.locator('#refSearch').fill('zzz-no-such-reference');
    await expect(page.locator('#refStatus')).toHaveText('No references match your filters.');
  });

  test('selecting a result updates details with accurate rights and applicability', async ({ page }) => {
    await page.goto(PAGE_PATH);

    // The reusable (all-permitted) source shows the positive rights label.
    const reusable = page.locator('#refResults .ref-result', { hasText: 'Technical Writing for Technicians' });
    await reusable.click();
    await expect(page.locator('#refDetail')).toContainText('Reusable with attribution under the recorded license.');
    await expect(page.locator('#refDetail')).toContainText('Charging-System Evidence and Diagnostic Decisions');
    await expect(page.locator('#refDetail')).toContainText('technical-communication');

    // The reference-only source shows the restricted label and explicit rows.
    const restricted = page.locator('#refResults .ref-result', { hasText: 'University Physics Volume 1' });
    await restricted.click();
    await expect(page.locator('#refDetail')).toContainText(
      'Reference only: citation/linking permitted; platform AI ingestion, direct reproduction, and commercial reuse are disabled.'
    );
    const rightsList = page.locator('#refDetail .ref-rights');
    await expect(rightsList).toContainText('Platform AI ingestion');
    await expect(rightsList).toContainText('Not allowed');
    await expect(rightsList).toContainText('Commercial use');
  });

  test('never renders a Verified badge, revision history, or withheld governance fields', async ({ page }) => {
    await page.goto(PAGE_PATH);
    await page.locator('#refResults .ref-result').first().click();
    const detail = page.locator('#refDetail');
    await expect(detail).toBeVisible();
    await expect(detail).not.toContainText('Verified');
    await expect(detail).not.toContainText('Revision history');
    await expect(detail).not.toContainText('Last updated');
    await expect(detail).not.toContainText('rights_basis');
    await expect(detail).not.toContainText('local_filename');
    // Whole page, not just the detail panel.
    await expect(page.locator('body')).not.toContainText('sae-reuse-guidance-2026');
  });

  test('keyboard: results are reachable and activated with Enter', async ({ page }) => {
    await page.goto(PAGE_PATH);
    const first = page.locator('#refResults .ref-result').first();

    // Native <button> results are focusable via keyboard/script.
    await first.focus();
    await expect(first).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#refDetail')).toContainText('Source type:');
  });

  test('focus visibility: focused controls show a visible focus indicator', async ({ page }) => {
    await page.goto(PAGE_PATH);
    // Text inputs reliably match :focus-visible on programmatic focus (unlike
    // buttons, whose :focus-visible depends on the last input modality), so the
    // search field is a stable place to assert the ring actually renders.
    const search = page.locator('#refSearch');
    await search.focus();
    await expect(search).toBeFocused();
    const outlineStyle = await search.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outlineStyle).not.toBe('none');
  });

  test('focus management: focus moves to the detail heading and returns on back', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PAGE_PATH);

    await page.locator('#refResults .ref-result').first().click();
    await expect(page.locator('#refDetailHeading')).toBeFocused();

    // On desktop the layout stays three-panel; the back control is hidden, so
    // verify the return path in the mobile test below.
  });

  test('responsive: desktop shows a three-panel layout (filters, results, details side by side)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PAGE_PATH);
    await expect(page.locator('#refResults .ref-result')).toHaveCount(3);

    const filters = await page.locator('.ref-filters').boundingBox();
    const results = await page.locator('.ref-results-col').boundingBox();
    const detail = await page.locator('#refDetail').boundingBox();

    // Relational (not pixel-exact): left → center → right ordering, all visible.
    expect(filters).not.toBeNull();
    expect(results).not.toBeNull();
    expect(detail).not.toBeNull();
    expect(filters.x + filters.width).toBeLessThanOrEqual(results.x + 1);
    expect(results.x + results.width).toBeLessThanOrEqual(detail.x + 1);
  });

  test('responsive: mobile shows a detail transition and returns focus to the result', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(PAGE_PATH);

    // Mobile: the detail panel is hidden until a result is chosen.
    await expect(page.locator('#refDetail')).toBeHidden();
    await expect(page.locator('.ref-results-col')).toBeVisible();

    const first = page.locator('#refResults .ref-result').first();
    await first.click();

    // Selecting a result swaps to the detail view and moves focus to its heading.
    await expect(page.locator('#refDetail')).toBeVisible();
    await expect(page.locator('.ref-results-col')).toBeHidden();
    await expect(page.locator('#refDetailHeading')).toBeFocused();

    // Returning restores the list and moves focus back to the selected result.
    await page.locator('#refBack').click();
    await expect(page.locator('.ref-results-col')).toBeVisible();
    await expect(page.locator('#refDetail')).toBeHidden();
    await expect(page.locator('#refResults .ref-result.is-selected')).toBeFocused();
  });

});

