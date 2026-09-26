const { test, expect } = require("@playwright/test");

test.use({ baseURL: "http://127.0.0.1:3003" });

test.describe("12 V starting-system template lab", () => {
  test("renders the reusable template with declared voltage and standardized libraries", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dashboard/student/starting-system-lab/");

    await expect(page.getByRole("heading", { name: "Interactive 12 V Starting-System Lab" })).toBeVisible();
    await expect(page.locator("#voltageProfile")).toContainText("12 V nominal");
    await expect(page.locator(".component .tm-symbol")).toHaveCount(7);
    await expect(page.locator(".wire[data-style-id]")).toHaveCount(8);
    await expect(page.locator('.wire[data-voltage-system-id="LV12"]')).toHaveCount(8);
    await expect(page.locator(".test-point")).toHaveCount(4);
    expect(errors).toEqual([]);
  });

  test("crank state shows control, starter power, and ground flow", async ({ page }) => {
    await page.goto("/dashboard/student/starting-system-lab/");
    await expect(page.locator(".wire.flow-control")).toHaveCount(1);
    await expect(page.locator(".wire.flow-power")).toHaveCount(4);
    await expect(page.locator(".wire.flow-ground")).toHaveCount(3);

    await page.locator("#stateSelect").selectOption("key-off");
    await expect(page.locator(".wire.flow-control")).toHaveCount(0);
    await expect(page.locator(".wire.flow-power")).toHaveCount(0);

    await page.locator("#stateSelect").selectOption("crank");
    await expect(page.locator("#stateBadge")).toContainText("Crank request");
  });

  test("open motor power fault interrupts the power path and ground resistance degrades it", async ({ page }) => {
    await page.goto("/dashboard/student/starting-system-lab/");

    await page.locator("#faultSelect").selectOption("FAULT_OPEN_POWER");
    await expect(page.locator('[data-connection-id="W_CONTACT_MOTOR"]')).toHaveClass(/fault-open/);
    await expect(page.locator('[data-connection-id="W_CONTACT_MOTOR"]')).not.toHaveClass(/flow-power/);

    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_GROUND");
    await expect(page.locator('[data-connection-id="W_MOTOR_GND"]')).toHaveClass(/fault-degraded/);
    await expect(page.locator('[data-connection-id="W_MOTOR_GND"]')).toHaveClass(/flow-ground/);
  });

  test("student dashboard exposes the starting-system lab", async ({ page }) => {
    await page.goto("/dashboard/student/");
    await expect(page.getByRole("link", { name: "12 V Starting Lab" })).toHaveAttribute(
      "href",
      "/dashboard/student/starting-system-lab/"
    );
  });
});
