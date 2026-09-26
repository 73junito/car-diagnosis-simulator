const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3012' });

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.describe('Curriculum content standards', () => {
  test('renders the canonical visual types and core rules', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/curriculum-standards/');
    await expect(page.locator('html')).toHaveAttribute('data-curriculum-standards', 'loaded');

    await expect(page.locator('#visual-types .standard-card')).toHaveCount(7);
    await expect(page.locator('#core-rules > li')).toHaveCount(20);

    const body = await page.locator('body').innerText();
    expect(body).toContain('Concept Diagram');
    expect(body).toContain('Flowchart');
    expect(body).toContain('Table');
    expect(body).toContain('Bar Chart');
    expect(body).toContain('Timeline');
    expect(body).toContain('Infographic');
    expect(body).toContain('Pie Chart');
    expect(body).toContain('Whole-part rationale required');
    expect(pageErrors).toEqual([]);
  });

  test('renders the canonical lesson structure and assessment governance', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/curriculum-standards/');

    await expect(page.locator('#lesson-structure > li')).toHaveCount(11);
    const structure = await page.locator('#lesson-structure > li').allTextContents();
    expect(structure[0]).toBe('Learning Objective');
    expect(structure).toContain('Worked Example');
    expect(structure).toContain('Guided Practice');
    expect(structure).toContain('Independent Scenario');
    expect(structure).toContain('Feedback And Retry');
    expect(structure[structure.length - 1]).toBe('Lesson Summary');

    const governance = await page.locator('#governance-rules').innerText();
    expect(governance).toContain(
      'Approved instructional content and approved assessment content remain separate states.'
    );
    expect(governance).toContain(
      'No scored item becomes available solely because it exists in storage.'
    );
    expect(pageErrors).toEqual([]);
  });

  test('is linked from the exam learning surfaces', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Curriculum standards' }))
      .toHaveAttribute('href', '/curriculum-standards/');

    await page.goto('/learning-path/');
    await expect(page.getByRole('link', { name: 'Curriculum standards' }))
      .toHaveAttribute('href', '/curriculum-standards/');

    await page.goto('/exam/');
    await expect(page.getByRole('link', { name: 'Curriculum standards' }))
      .toHaveAttribute('href', '/curriculum-standards/');
  });
});
