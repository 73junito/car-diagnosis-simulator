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

  test("relay high-resistance fault uses committed current artifact", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/dashboard/student/relay-load-lab/");
    await page.selectOption("#faultSelect", "FAULT_HIGH_RES_LOAD_POWER");

    await expect(page.locator("#engCurrent")).toHaveText("1.593 A");
    await expect(page.locator("#relayComparisonSummary")).toContainText("healthy 1.989 A");
    await expect(page.locator("#engineeringFormula"))
      .toContainText("Validated engineering artifact supplies the displayed healthy/fault current pair");
    expect(errors).toEqual([]);
  });

  test("starting modeled scenarios remain separate from measurement evidence", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/dashboard/student/starting-system-lab/");
    await page.selectOption("#startingModelScenario", "within");
    await expect(page.locator("#startingModelScenarioResult")).toContainText("0.350 V");
    await expect(page.locator("#startingModelScenarioResult")).toContainText("This is not a measurement");
    await expect(page.locator("#startingComparisonSummary")).toContainText("within the selected 0.400 V authoritative maximum");

    await page.selectOption("#startingModelScenario", "exceeds");
    await expect(page.locator("#startingComparisonSummary")).toContainText("exceeds the selected 0.400 V authoritative maximum");

    await page.fill("#measuredStarterDrop", "0.350");
    await expect(page.locator("#startingComparisonSummary")).toContainText("Authoritative measurement comparison");
    await expect(page.locator("#startingComparisonSummary")).not.toContainText("Training-model scenario comparison");

    await page.fill("#measuredStarterDrop", "");
    await page.selectOption("#startingModelScenario", "open");
    await expect(page.locator("#startingModelScenarioResult")).toContainText("numeric cable drop unavailable");
    await expect(page.locator("#startingComparisonSummary")).toContainText("not represented as a finite modeled voltage drop");
    expect(errors).toEqual([]);
  });
});
