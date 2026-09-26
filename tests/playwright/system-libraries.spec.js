const { test, expect } = require("@playwright/test");

test.use({ baseURL: "http://127.0.0.1:3003" });

test.describe("standardized system libraries", () => {
  test("visual library exposes expanded symbols, connection styles, and voltage domains", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/dashboard/student/symbol-library/");
    await expect(page.getByRole("heading", { name: "Standardized Schematic Libraries" })).toBeVisible();
    await expect(page.locator(".symbol-card")).toHaveCount(65);
    await expect(page.locator(".connection-card")).toHaveCount(11);
    await expect(page.locator(".voltage-card")).toHaveCount(4);
    await expect(page.locator(".voltage-card.voltage-domain-traction")).toContainText("example only");
    await expect(page.locator(".voltage-card.voltage-domain-traction")).toContainText("actual declared vehicle/system value");
    expect(errors).toEqual([]);
  });

  test("charging lab uses standardized connection and voltage identifiers", async ({ page }) => {
    await page.goto("/dashboard/student/circuit-lab/");
    await expect(page.locator(".wire[data-style-id]")).toHaveCount(8);
    await expect(page.locator('.wire[data-style-id="electrical.power"]')).toHaveCount(3);
    await expect(page.locator('.wire[data-style-id="electrical.ground-return"]')).toHaveCount(3);
    await expect(page.locator('.wire[data-style-id="electrical.control"]')).toHaveCount(2);
    await expect(page.locator('.wire[data-voltage-system-id="LV12"]')).toHaveCount(8);
    await expect(page.locator("#voltageProfile")).toContainText("12 V nominal");
  });
});
