const { test, expect } = require("@playwright/test");

test.use({ baseURL: "http://127.0.0.1:3003" });

test.describe("browser engineering artifact adapter", () => {
  test("sensor nominal short-ground uses committed artifact", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/dashboard/student/sensor-lab/");
    await page.selectOption("#faultSelect", "FAULT_SIGNAL_SHORT_GROUND");

    await expect(page.locator("#engIdealSignal")).toHaveText("2.5 V");
    await expect(page.locator("#engObservedSignal")).toHaveText("0 V");
    await expect(page.locator("#sensorEngineeringFormula"))
      .toContainText("Validated engineering artifact applied for the 50% nominal training state.");
    expect(errors).toEqual([]);
  });
  test("actuator nominal short-ground uses committed artifact", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/dashboard/student/actuator-lab/");
    await page.selectOption("#faultSelect", "FAULT_PWM_SHORT_GROUND");

    await expect(page.locator("#engIdealAverage")).toHaveText("3.6 V");
    await expect(page.locator("#engObservedCommand")).toHaveText("0 V avg");
    await expect(page.locator("#actuatorEngineeringFormula"))
      .toContainText("Validated engineering artifact applied for the 30% nominal training state.");
    expect(errors).toEqual([]);
  });
});
