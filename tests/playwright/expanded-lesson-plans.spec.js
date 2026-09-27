const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3012' });

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.describe('Expanded lesson plans', () => {
  test('renders all undergraduate and graduate plans with expanded content', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/lesson-plans/');
    await expect(page.locator('html')).toHaveAttribute('data-lesson-plans', 'loaded');

    await expect(page.locator('#undergraduate-plan-list .expanded-plan')).toHaveCount(4);
    await expect(page.locator('#graduate-plan-list .expanded-plan')).toHaveCount(5);
    await expect(page.locator('.expanded-plan')).toHaveCount(9);
    await expect(page.locator('.expanded-plan .program-context')).toHaveCount(9);

    await expect(page.locator('.expanded-plan .objective-list > li')).toHaveCount(27);
    await expect(page.locator('.expanded-plan .instruction-block-list > li')).toHaveCount(99);
    await expect(page.locator('.expanded-plan .lesson-visual-grid > article')).toHaveCount(38);

    expect(pageErrors).toEqual([]);
  });

  test('shows the full charging-system instructional plan', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/lesson-plans/#ug-electrical-charging-system');
    const plan = page.locator('#ug-electrical-charging-system');

    await expect(plan).toBeVisible();
    await expect(plan.getByRole('heading', { name: 'Charging-System Evidence and Diagnostic Decisions' }))
      .toBeVisible();
    await expect(plan.getByText('Electrical safety fundamentals')).toBeVisible();
    await expect(plan.getByText('evidence-to-decision reasoning')).toBeVisible();
    await expect(plan.getByText(/AUT-120 · Electrical I · Direct Course Alignment/)).toBeVisible();
    await expect(plan.locator('.eyebrow')).toHaveText('Electrical I · 180 MIN');
    await expect(plan.getByText(/battery, alternator, diode rectifier, voltage regulator, and vehicle electrical loads/)).toBeVisible();

    await expect(plan.locator('.lesson-readiness span').filter({ hasText: 'Complete Review Ready' })).toBeVisible();
    await expect(plan.locator('.lesson-readiness span').filter({ hasText: 'Pending Human Technical And Chunk Review' })).toBeVisible();

    await plan.getByText('Instructional sequence').click();
    await expect(plan.locator('.instruction-block-list > li')).toHaveCount(11);
    await expect(plan.locator('.lesson-teaching-points > li')).toHaveCount(44);
    await expect(plan.getByText(/system, voltage domain, test method, and measurement context/)).toBeVisible();
    await expect(plan.getByText(/operating condition, test location, voltage domain, and units/)).toBeVisible();
    await expect(plan.getByText(/alternator-battery-cable system/)).toBeVisible();
    await expect(plan.getByText(/citation-only external reference; no reusable vendor excerpt stored/)).toBeVisible();
    await expect(plan.getByText(/0\.350 V training measurement is above the design basis/)).toBeVisible();
    await expect(plan.getByText(/Do not apply the 0\.200 V reference when wiring configuration or conductor identity is unknown/)).toBeVisible();
    await expect(plan.getByText(/rights-cleared; technical\/chunk approval pending/).first()).toBeVisible();

    await plan.getByText('Planned visuals').click();
    await expect(plan.locator('.lesson-visual-grid > article')).toHaveCount(5);
    await expect(plan.getByText('Charging-system relationship map')).toBeVisible();
    await expect(plan.getByText('Evidence-to-next-check flow')).toBeVisible();
    await expect(plan.getByText(/0\.300 V source-backed design basis/)).toBeVisible();
    await expect(plan.getByText(/0\.500 V source-backed maximum/)).toBeVisible();

    await plan.getByText('Evidence focus and boundaries').click();
    await expect(plan.getByText(/technical review and chunk approval remain pending/)).toBeVisible();
    await expect(plan.locator('.pending-chunk-list li').filter({ hasText: 'frontiers-alternator-primary-source-p7' })).toBeVisible();
    await expect(plan.locator('.pending-chunk-list li').filter({ hasText: 'frontiers-alternator-ac-dc-rectification-p7' })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('links every pathway course to its expanded lesson plan', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/learning-path/');
    await expect(page.locator('.lesson-detail-link')).toHaveCount(9);

    const electrical = page.locator('#electrical-1');
    await electrical.locator('summary').click();
    const link = electrical.getByRole('link', { name: /View expanded lesson plan/ });
    await expect(link).toHaveAttribute('href', '/lesson-plans/#ug-electrical-charging-system');

    await link.click();
    await expect(page).toHaveURL(/\/lesson-plans\/#ug-electrical-charging-system$/);
    await expect(page.locator('#ug-electrical-charging-system')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
