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

    await expect(page.locator('#undergraduate-plan-list .expanded-plan')).toHaveCount(6);
    await expect(page.locator('#graduate-plan-list .expanded-plan')).toHaveCount(5);
    await expect(page.locator('.expanded-plan')).toHaveCount(11);
    await expect(page.locator('.expanded-plan .program-context')).toHaveCount(11);

    await expect(page.locator('.expanded-plan .objective-list > li')).toHaveCount(34);
    await expect(page.locator('.expanded-plan .instruction-block-list > li')).toHaveCount(123);
    await expect(page.locator('.expanded-plan .lesson-visual-grid > article')).toHaveCount(46);

    expect(pageErrors).toEqual([]);
  });


  test('renders the planned AUT 101 foundations lesson with non-scored boundaries', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/lesson-plans/#ug-aut101-foundations');
    const plan = page.locator('#ug-aut101-foundations');

    await expect(plan).toBeVisible();
    await expect(plan.getByRole('heading', { name: 'Automotive Systems, Professional Practice, and Evidence Foundations' })).toBeVisible();
    await expect(plan.locator('.objective-list > li')).toHaveCount(3);

    await plan.getByText('Instructional sequence').click();
    await expect(plan.locator('.instruction-block-list > li')).toHaveCount(11);

    await plan.getByText('Planned visuals').click();
    await expect(plan.locator('.lesson-visual-grid > article')).toHaveCount(4);
    await expect(plan.getByText('Major vehicle-system relationships')).toBeVisible();
    await expect(plan.getByText('Concern-to-next-step workflow')).toBeVisible();

    await plan.getByText('Evidence focus and boundaries').click();
    await expect(plan.getByText(/Scored assessment remains a separate approval state/i)).toBeVisible();
    await expect(plan.getByText(/Vehicle-specific procedures, values, limits, and specifications require an appropriate authoritative source/i)).toBeVisible();

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
    await expect(plan.locator('.objective-list').getByText(/battery, alternator, diode rectifier, voltage regulator, and vehicle electrical loads/)).toBeVisible();

    await expect(plan.locator('.lesson-readiness span').filter({ hasText: 'Complete Review Ready' })).toBeVisible();
    await expect(plan.locator('.lesson-readiness span').filter({ hasText: 'Pending Human Technical And Chunk Review' })).toBeVisible();

    await plan.getByText('Instructional sequence').click();
    await expect(plan.locator('.instruction-block-list > li')).toHaveCount(11);
    await expect(plan.locator('.lesson-teaching-points > li')).toHaveCount(45);
    await expect(plan.getByText(/system, voltage domain, test method, and measurement context/)).toBeVisible();
    await expect(plan.getByText(/operating condition, test location, voltage domain, and units/)).toBeVisible();
    await expect(plan.getByText(/alternator-battery-cable system/)).toBeVisible();
    await expect(plan.getByText('citation-only external reference; no reusable vendor excerpt stored', { exact: true })).toBeVisible();
    await expect(plan.getByText(/citation-only external technical reference; no reusable vendor excerpt, figure, or chunk is stored/)).toBeVisible();
    await expect(plan.getByText(/vehicle-specific service information/)).toBeVisible();
    await expect(plan.getByText(/verify the final conclusion using the applicable vehicle-specific procedure and authoritative information/)).toBeVisible();
    await expect(plan.getByText(/0\.350 V hypothetical voltage-drop observation is above the 0\.300 V design basis but below the 0\.500 V maximum/)).toBeVisible();
    await expect(plan.getByText(/Do not apply the cited 0\.200 V 3-wire #2-lead maximum until the source applicability is verified/)).toBeVisible();
    await expect(plan.getByText(/Design Basis/).first()).toBeVisible();
    await expect(plan.getByText(/rights-cleared; technical\/chunk approval pending/).first()).toBeVisible();
    await expect(plan.locator('.independent-case')).toHaveCount(2);
    await expect(plan.getByRole('heading', { name: 'Charging warning during operation' })).toBeVisible();
    await expect(plan.getByRole('heading', { name: 'Electrical load with dim and flickering lamps' })).toBeVisible();
    await expect(plan.getByText('TP_LOAD_PWR')).toBeVisible();
    await expect(plan.getByText('11.7 V DC')).toBeVisible();
    await expect(plan.getByText(/Vehicle-specific diagnostic procedure and limits intentionally not supplied/).first()).toBeVisible();
    await expect(plan.getByText(/No pass\/fail meaning or failed component is supplied/)).toBeVisible();

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

  test('renders AUT-250 modules with learner navigation and local completion state', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/lesson-plans/#ug-hev-foundations');
    await expect(page.locator('html')).toHaveAttribute('data-aut250-modules', 'loaded');

    const plan = page.locator('#ug-hev-foundations');
    const modules = plan.locator('[data-course-module]');
    await expect(modules).toHaveCount(6);
    await expect(plan.locator('.module-jump-nav a')).toHaveCount(6);
    await expect(plan.locator('.module-progress')).toContainText('0 / 6');

    const battery = plan.locator('#aut250-m1-battery-systems');
    await expect(battery.getByRole('heading', { name: 'Battery Systems, Monitoring, and State Estimation' })).toBeVisible();
    await expect(battery.locator('.module-objective-list li')).toHaveCount(4);

    await battery.getByText('Lessons').click();
    await expect(battery.locator('.module-lesson')).toHaveCount(3);
    await expect(battery.getByText(/Battery diagnosis requires separating direct observations from calculated states/i)).toBeVisible();

    await battery.getByText('Planned visuals').click();
    await expect(battery.locator('.module-visual-grid article')).toHaveCount(3);
    await expect(battery.locator('.module-safety-boundary')).toContainText(/vehicle-specific/i);

    const completeButton = battery.locator('[data-module-complete-toggle]');
    await expect(completeButton).toHaveText('Mark complete');
    await completeButton.click();
    await expect(completeButton).toHaveAttribute('aria-pressed', 'true');
    await expect(completeButton).toHaveText('Completed');
    await expect(plan.locator('.module-progress')).toContainText('1 / 6');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-aut250-modules', 'loaded');
    await expect(page.locator('#aut250-m1-battery-systems [data-module-complete-toggle]'))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#ug-hev-foundations .module-progress')).toContainText('1 / 6');

    expect(pageErrors).toEqual([]);
  });

  test('renders all original AUT-250 instructional visuals without placeholders', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/lesson-plans/#ug-hev-foundations');
    await expect(page.locator('html')).toHaveAttribute('data-aut250-modules', 'loaded');

    const plan = page.locator('#ug-hev-foundations');
    const modules = plan.locator('[data-course-module]');
    await expect(modules).toHaveCount(6);

    for (let index = 0; index < 6; index += 1) {
      const module = modules.nth(index);
      await module.getByText('Planned visuals').click();
      await expect(module.locator('.module-visual-grid > article')).toHaveCount(3);
    }

    await expect(plan.locator('.module-svg')).toHaveCount(10);
    await expect(plan.locator('.module-data-table')).toHaveCount(6);
    await expect(plan.locator('.boundary-visual')).toHaveCount(1);
    await expect(plan.locator('.timeline-visual')).toHaveCount(1);
    await expect(plan.locator('.visual-placeholder')).toHaveCount(0);

    await expect(plan.locator('.module-svg').first()).toHaveAttribute('role', 'img');
    await expect(plan.locator('.module-data-table').first()).toHaveAttribute('aria-label', /battery/i);
    await expect(plan.getByRole('heading', { name: 'Request → Measure → Compare → Correlate → Verify', exact: true })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('renders the 40-question AUT-250 training bank with local feedback only', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/lesson-plans/#ug-hev-foundations');
    await expect(page.locator('html')).toHaveAttribute('data-aut250-training-questions', 'loaded');

    const plan = page.locator('#ug-hev-foundations');
    const modules = plan.locator('[data-course-module]');
    await expect(modules).toHaveCount(6);

    for (let index = 0; index < 6; index += 1) {
      const module = modules.nth(index);
      await module.getByText(/Training questions \(/).click();
    }

    await expect(plan.locator('[data-training-question]')).toHaveCount(40);
    await expect(plan.locator('.training-question-status')).toHaveCount(40);
    await expect(plan.locator('.training-boundary')).toHaveCount(40);

    const first = plan.locator('[data-training-question="aut250-m1-q01"]');
    await expect(first).toContainText(/Why should a technician distinguish direct battery measurements/i);
    await expect(first.locator('input[type="radio"]')).toHaveCount(4);
    await first.locator('input[value="A"]').check();
    await first.getByRole('button', { name: 'Check answer' }).click();
    await expect(first.locator('[data-training-feedback]')).toContainText('Not yet.');
    await expect(first.locator('[data-training-feedback]')).toContainText(/model-derived states are different evidence types/i);

    await first.locator('input[value="B"]').check();
    await first.getByRole('button', { name: 'Check answer' }).click();
    await expect(first.locator('[data-training-feedback]')).toContainText('Correct.');

    await expect(plan.getByText(/not scored · not eligible for high-stakes assessment/i).first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('links every pathway course to its expanded lesson plan', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/learning-path/');
    await expect(page.locator('.lesson-detail-link')).toHaveCount(11);

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
