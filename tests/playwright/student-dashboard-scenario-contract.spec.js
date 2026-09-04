const { test, expect } = require('@playwright/test');

const expected = [
  ['no-crank-clicking', 'Engine will not crank. Clicking sound when key is turned.'],
  ['no-start', 'Engine cranks but does not start.'],
  ['overheating', 'Engine overheats after 10 minutes of driving.'],
  ['electrical-load', 'Headlights are dim and flicker while driving.'],
  ['misfire-acceleration', 'Engine misfires under acceleration.'],
  ['steering-alignment', 'Car pulls to the right while driving.'],
  ['hvac-cooling', 'Air conditioning not cooling.'],
  ['stalling', 'Engine stalls at idle.'],
  ['misfire-p0300', 'Check engine light is on. Code P0300 detected.'],
  ['power-loss', 'Vehicle struggles to accelerate uphill.'],
  ['no-crank-starter-click', 'Engine will not crank. Starter clicks when key is turned.'],
  ['intermittent-starting', 'Engine cranks slowly, intermittent clicking, sometimes fails to start.'],
  ['charging-system', 'Battery drains while driving, warning lamp for charging appears.'],
  ['can-bus-network', 'Intermittent module communication errors; multiple U-codes present.'],
  ['hybrid-ev-isolation', 'Hybrid system disables on startup; HV battery isolation fault logged.'],
  ['diesel-aftertreatment', 'DPF regeneration incomplete; excessive soot and reduced engine power.'],
  ['hybrid-ev-insulation', 'Hybrid/EV high-voltage insulation fault; vehicle disables on startup.'],
  ['automatic-transmission-delayed-drive', 'Delayed or harsh shift into Drive.'],
  ['manual-transmission-no-drive', 'Clutch pedal feels normal but vehicle will not move in gear.'],
  ['differential-speed-whine', 'Whine or howl that changes with vehicle speed.'],
  ['transaxle-fluid-leak-shift-hesitation', 'Fluid leak with shift hesitation or gear noise.']
];

test('renders and wires all 21 scenario cards to unique diagnostic routes', async ({ page }) => {
  await page.goto('/dashboard/student/', { waitUntil: 'domcontentloaded' });

  const cards = page.locator('article.tm-scenario-v2-card');
  await expect(cards).toHaveCount(expected.length);

  for (let index = 0; index < expected.length; index++) {
    const [scenarioKey, title] = expected[index];
    const card = cards.nth(index);

    await expect(card.getByRole('heading', { name: title })).toBeVisible();

    const startLink = card.getByRole('link', { name: 'Start' });
    await expect(startLink).toHaveAttribute(
      'href',
      `/dashboard/student/scenario/?scenario=${scenarioKey}`
    );
  }
});
