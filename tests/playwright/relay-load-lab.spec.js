const { test, expect } = require("@playwright/test");

test.use({ baseURL: "http://127.0.0.1:3003" });

test.describe("12 V relay-controlled load lab", () => {
  test("renders the reusable template and declared 12 V domain", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dashboard/student/relay-load-lab/");
    await expect(page.getByRole("heading", { name:"Interactive 12 V Relay-Controlled Load Lab" })).toBeVisible();
    await expect(page.locator("#voltageProfile")).toContainText("12 V nominal");
    await expect(page.locator(".component .tm-symbol")).toHaveCount(8);
    await expect(page.locator(".wire[data-style-id]")).toHaveCount(9);
    await expect(page.locator(".test-point")).toHaveCount(5);
    expect(errors).toEqual([]);
  });

  test("command-on distinguishes control, power, and ground flow", async ({ page }) => {
    await page.goto("/dashboard/student/relay-load-lab/");
    await expect(page.locator(".wire.flow-control")).toHaveCount(1);
    await expect(page.locator(".wire.flow-power")).toHaveCount(5);
    await expect(page.locator(".wire.flow-ground")).toHaveCount(3);

    await page.locator("#stateSelect").selectOption("key-on-command-off");
    await expect(page.locator(".wire.flow-control")).toHaveCount(0);
    await expect(page.locator(".wire.flow-power")).toHaveCount(0);
  });

  test("control and load faults affect their respective conductors", async ({ page }) => {
    await page.goto("/dashboard/student/relay-load-lab/");
    await page.locator("#faultSelect").selectOption("FAULT_OPEN_CONTROL_FEED");
    await expect(page.locator('[data-connection-id="W_SWITCH_COIL"]')).toHaveClass(/fault-open/);
    await expect(page.locator('[data-connection-id="W_CONTACT_LOAD"]')).toHaveClass(/flow-power/);

    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_LOAD_GROUND");
    await expect(page.locator('[data-connection-id="W_LOAD_GND"]')).toHaveClass(/fault-degraded/);
    await expect(page.locator('[data-connection-id="W_LOAD_GND"]')).toHaveClass(/flow-ground/);
  });

  test("student dashboard links to the relay-load lab", async ({ page }) => {
    await page.goto("/dashboard/student/");
    await expect(page.getByRole("link", { name:"12 V Relay Load Lab" })).toHaveAttribute("href","/dashboard/student/relay-load-lab/");
  });
});
