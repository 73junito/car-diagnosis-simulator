const { test, expect } = require('@playwright/test');

test('student scenario cards stay compact with explicit actions', async ({ page }) => {
  await page.goto('/dashboard/student/');

  const cards = page.locator('article.tm-scenario-v2-card');
  await expect(cards).toHaveCount(6);

  for (let index = 0; index < 6; index += 1) {
    const card = cards.nth(index);

    // The card itself is informational, not a giant click target.
    await expect(card).not.toHaveAttribute('role', 'button');
    await expect(card).not.toHaveAttribute('tabindex', '0');

    const detailsBtn = card.getByRole('button', { name: 'Details' });
    await expect(detailsBtn).toHaveCount(1);

    const startLink = card.getByRole('link', { name: /start|resume|practice again/i });
    await expect(startLink).toHaveCount(1);
    await expect(startLink).toHaveAttribute('href', /\/dashboard\/student\/scenario\/\?scenario=/);

    // The compact dashboard card intentionally omits large scenario media.
    await expect(card.locator('img')).toHaveCount(0);

    // Current fixtures derive title and body from the same symptom text.
    await expect(card.locator('.tm-scenario-v2-card-text')).toHaveCount(0);
  }

  await page.evaluate(() => {
    window.SCENARIO_REGISTRY[0].shortSymptom = 'Distinct supporting symptom';
    document.getElementById('searchInput').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(cards.first().locator('.tm-scenario-v2-card-text')).toHaveText('Distinct supporting symptom');

  await page.getByRole('button', { name: 'Show all scenarios' }).click();
  await expect(cards).toHaveCount(21);
});
