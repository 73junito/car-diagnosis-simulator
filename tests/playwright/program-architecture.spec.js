const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3012' });

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.describe('Program architecture', () => {
  test('renders the exact 68-credit undergraduate and 30-credit graduate structures', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/program-architecture/');
    await expect(page.locator('html')).toHaveAttribute('data-program-architecture', 'loaded');

    const undergraduate = page.locator('#undergraduate-automotive-technology-aas');
    const graduate = page.locator('#graduate-automotive-engineering-technology');

    await expect(undergraduate).toBeVisible();
    await expect(graduate).toBeVisible();

    await expect(undergraduate.locator('.program-credit-total strong')).toHaveText('68');
    await expect(graduate.locator('.program-credit-total strong')).toHaveText('30');

    await expect(undergraduate.locator('tbody tr')).toHaveCount(23);
    await expect(graduate.locator('tbody tr')).toHaveCount(10);

    expect(pageErrors).toEqual([]);
  });

  test('preserves the verified Kansas common-course core and proposed distinction', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/program-architecture/');
    const undergraduate = page.locator('#undergraduate-automotive-technology-aas');

    await expect(
      undergraduate.getByText('VERIFIED KANSAS COMMON COURSE', { exact: true })
    ).toHaveCount(4);

    for (const title of ['Brakes I', 'Electrical I', 'Engine Performance I', 'Suspension & Steering I']) {
      await expect(undergraduate.locator('tbody tr').filter({ hasText: title })).toHaveCount(1);
    }

    await expect(undergraduate.locator('tbody tr').filter({ hasText: 'Advanced Diagnostic Strategy' }))
      .toHaveCount(1);
    await expect(undergraduate.locator('tbody tr').filter({ hasText: 'AI-Assisted Automotive Diagnostics' }))
      .toHaveCount(1);

    expect(pageErrors).toEqual([]);
  });

  test('keeps education-track graduate content outside the engineering-technology core', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/program-architecture/');
    const graduate = page.locator('#graduate-automotive-engineering-technology');

    await expect(graduate.locator('.program-supplemental article')).toHaveCount(2);
    await expect(graduate.getByText('Curriculum & Assessment Design', { exact: true }))
      .toBeVisible();
    await expect(graduate.getByText('Technical Instructional Leadership', { exact: true }))
      .toBeVisible();

    await expect(graduate.locator('tbody tr').filter({ hasText: 'AI, Data Analytics & Intelligent Diagnostics' }))
      .toHaveCount(1);
    await expect(graduate.locator('tbody tr').filter({ hasText: 'Graduate Capstone / Applied Research' }))
      .toHaveCount(1);

    expect(pageErrors).toEqual([]);
  });

  test('is linked from the existing learning-path architecture section', async ({ page }) => {
    await page.goto('/learning-path/');
    const link = page.getByRole('link', {
      name: /View full 68-credit undergraduate and 30-credit graduate program architecture/
    });
    await expect(link).toHaveAttribute('href', '/program-architecture/');
  });
});
