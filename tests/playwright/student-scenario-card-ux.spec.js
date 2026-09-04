const { test, expect } = require('@playwright/test');

test('student scenario cards use explicit preview and diagnostic actions', async ({ page }) => {
  await page.goto('/dashboard/student/');

  const cards = page.locator('article.tm-scenario-v2-card');
  await expect(cards).toHaveCount(21);

  for (let index = 0; index < 21; index += 1) {
    const card = cards.nth(index);

    // Card should NOT be clickable (no role=button or tabindex=0)
    await expect(card).not.toHaveAttribute('role', 'button');
    await expect(card).not.toHaveAttribute('tabindex', '0');

    // Card MUST have exactly one Preview button
    const previewBtn = card.getByRole('button', { name: /preview scenario|preview/i });
    await expect(previewBtn).toHaveCount(1);

    // Card MUST have exactly one Start Diagnostic link
    const startLink = card.getByRole('link', { name: /start diagnostic|start/i });
    await expect(startLink).toHaveCount(1);
    await expect(startLink).toHaveAttribute('href', /\/dashboard\/student\/scenario\/\?scenario=/);

    // Image must exist and have alt text
    const image = card.locator('img').first();
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('alt', /\S+/);
  }
});
