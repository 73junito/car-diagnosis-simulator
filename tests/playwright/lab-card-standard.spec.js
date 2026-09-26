const { test, expect } = require("@playwright/test");

test.use({ baseURL: "http://127.0.0.1:3003" });

const labs = [
  "/dashboard/student/circuit-lab/",
  "/dashboard/student/starting-system-lab/",
  "/dashboard/student/relay-load-lab/",
  "/dashboard/student/sensor-lab/",
  "/dashboard/student/actuator-lab/",
  "/dashboard/student/network-lab/"
];

test.describe("shared lab component-card standard", () => {
  for (const route of labs) {
    test(`${route} uses transparent component hit areas and white label cards`, async ({ page }) => {
      await page.goto(route);
      const hitTarget = page.locator(".component .hit-target").first();
      const labelCard = page.locator(".component-label .label-chip").first();

      await expect(hitTarget).toBeVisible();
      await expect(labelCard).toBeVisible();

      const hitFill = await hitTarget.evaluate((el) => getComputedStyle(el).fill);
      const labelFill = await labelCard.evaluate((el) => getComputedStyle(el).fill);
      const labelStroke = await labelCard.evaluate((el) => getComputedStyle(el).stroke);

      expect(hitFill).toBe("rgba(0, 0, 0, 0)");
      expect(labelFill).toBe("rgb(255, 255, 255)");
      expect(labelStroke).toBe("rgb(148, 163, 184)");
    });
  }
});
