const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://127.0.0.1:3003' });

test.describe('Interactive circuit lab symbol flow', () => {
  test('renders recognizable schematic symbols and default charging flow', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/dashboard/student/circuit-lab/');
    await expect(page.getByRole('heading', { name: 'Interactive Charging-System Circuit Lab' })).toBeVisible();

    await expect(page.locator('[data-component-id="BAT1"]')).toBeVisible();
    await expect(page.locator('[data-component-id="ALT1"]')).toBeVisible();
    await expect(page.locator('[data-component-id="GND1"]')).toBeVisible();
    await expect(page.locator('.test-point')).toHaveCount(3);

    await expect(page.locator('.wire.flow-power')).toHaveCount(3);
    await expect(page.locator('.wire.flow-ground')).toHaveCount(3);
    await expect(page.locator('.wire.flow-control')).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test('operating state changes conceptual current flow', async ({ page }) => {
    await page.goto('/dashboard/student/circuit-lab/');

    await page.locator('#stateSelect').selectOption('key-off');
    await expect(page.locator('.wire.flow-power')).toHaveCount(0);
    await expect(page.locator('#stateBadge')).toHaveText('Key off');

    await page.locator('#stateSelect').selectOption('key-on');
    await expect(page.locator('.wire.flow-power')).toHaveCount(2);
    await expect(page.locator('.wire.flow-ground')).toHaveCount(2);
  });

  test('open charge-feed fault visibly interrupts B+ trace', async ({ page }) => {
    await page.goto('/dashboard/student/circuit-lab/');
    await page.locator('#faultSelect').selectOption('FAULT_OPEN_CHARGE_FEED');
    await page.getByRole('button', { name: 'Trace B+ path' }).click();

    await expect(page.locator('.wire.fault-open')).toHaveCount(1);
    await expect(page.locator('#inspectorContent')).toContainText('B+ path is open');
  });

  test('high-resistance ground fault remains connected but visibly degraded', async ({ page }) => {
    await page.goto('/dashboard/student/circuit-lab/');
    await page.locator('#faultSelect').selectOption('FAULT_HIGH_RES_GROUND');
    await page.getByRole('button', { name: 'Trace ground return' }).click();

    await expect(page.locator('.wire.fault-degraded')).toHaveCount(1);
    await expect(page.locator('#inspectorContent')).toContainText('high-resistance');
  });

  test('component and test-point inspection explain the training boundary', async ({ page }) => {
    await page.goto('/dashboard/student/circuit-lab/');
    await page.locator('[data-component-id="BAT1"]').click();
    await expect(page.locator('#inspectorContent')).toContainText('Battery');
    await expect(page.locator('#inspectorContent')).toContainText(/electrical energy source/i);

    await page.locator('.test-point').first().click();
    await expect(page.locator('#inspectorContent')).toContainText('Vehicle-specific authoritative service information is required');
  });
});
