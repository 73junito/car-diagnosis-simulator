const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3012' });

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.describe('Exam launch preview', () => {
  test('renders the planned student flow with scored launch locked', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/exam/');

    await expect(page.getByRole('heading', { name: 'See the exam flow before launch.' }))
      .toBeVisible();
    await expect(page.getByText('Launch locked', { exact: true })).toBeVisible();

    const launchButton = page.getByRole('button', { name: 'Start scored exam' });
    await expect(launchButton).toBeDisabled();
    await expect(launchButton).toHaveAttribute('aria-disabled', 'true');

    await expect(page.locator('.exam-flow > li')).toHaveCount(4);
    expect(pageErrors).toEqual([]);
  });

  test('keeps draft questions, scoring, payment, and credentials out of the preview', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/exam/');

    await expect(page.getByText('Does not expose draft or unapproved questions')).toBeVisible();
    await expect(page.getByText('Does not create a scored attempt')).toBeVisible();
    await expect(page.getByText('Does not collect payment or grant entitlement')).toBeVisible();
    await expect(page.getByText('Does not issue a result, certificate, or credential')).toBeVisible();

    await expect(page.locator('input[type="radio"]')).toHaveCount(0);
    await expect(page.locator('form')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('is reachable from exam home and preserves the training path', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Exam preview' })).toHaveAttribute('href', '/exam/');
    await page.getByRole('link', { name: 'Exam preview' }).click();

    await expect(page).toHaveURL(/\/exam\/$/);
    await expect(page.getByRole('link', { name: /Continue charging-system training/ }))
      .toHaveAttribute(
        'href',
        'https://app.autolearnpro.com/dashboard/student/scenario/?scenario=charging-system'
      );
    const lessonLink = page.getByRole('link', { name: /Review Electrical 1 lesson plan/ });
    await expect(lessonLink).toHaveAttribute('href', '/learning-path/#electrical-1');
    await lessonLink.click();

    await expect(page).toHaveURL(/\/learning-path\/#electrical-1$/);
    await expect(page.locator('#electrical-1')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
