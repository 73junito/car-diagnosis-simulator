const { test, expect } = require("@playwright/test");
test.use({baseURL:"http://127.0.0.1:3003"});

test.describe("healthy-vs-fault comparison engine",()=>{
  test("relay compares modeled healthy and high-resistance current, but not opens",async({page})=>{
    await page.goto("/dashboard/student/relay-load-lab/");
    await expect(page.locator("#relayComparisonSummary")).toContainText("Healthy training baseline");
    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_LOAD_POWER");
    await expect(page.locator("#relayComparisonSummary")).toContainText("Training-model comparison");
    await expect(page.locator("#relayComparisonSummary")).toContainText("Numeric delta only");
    await expect(page.locator("#relayComparisonSummary")).toHaveClass(/changed/);
    await page.locator("#faultSelect").selectOption("FAULT_OPEN_RELAY_OUTPUT");
    await expect(page.locator("#relayComparisonSummary")).toContainText("unavailable or intentionally not inferred");
    await expect(page.locator("#relayComparisonSummary")).toHaveClass(/unavailable/);
  });

  test("sensor compares idealized shorts but leaves unsupported faults unavailable",async({page})=>{
    await page.goto("/dashboard/student/sensor-lab/");
    await page.locator("#faultSelect").selectOption("FAULT_SIGNAL_SHORT_GROUND");
    await expect(page.locator("#sensorComparisonSummary")).toContainText("healthy 2.500 V");
    await expect(page.locator("#sensorComparisonSummary")).toContainText("fault 0.000 V");
    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_SENSOR_GROUND");
    await expect(page.locator("#sensorComparisonSummary")).toContainText("unavailable or intentionally not inferred");
  });

  test("actuator compares idealized PWM shorts but leaves open command unavailable",async({page})=>{
    await page.goto("/dashboard/student/actuator-lab/");
    await page.locator("#faultSelect").selectOption("FAULT_PWM_SHORT_GROUND");
    await expect(page.locator("#actuatorComparisonSummary")).toContainText("healthy 3.600 V avg");
    await expect(page.locator("#actuatorComparisonSummary")).toContainText("fault 0.000 V avg");
    await page.locator("#faultSelect").selectOption("FAULT_OPEN_PWM");
    await expect(page.locator("#actuatorComparisonSummary")).toContainText("unavailable or intentionally not inferred");
  });

  test("starting comparison follows authoritative applicability and open-circuit boundary",async({page})=>{
    await page.goto("/dashboard/student/starting-system-lab/");
    await page.locator("#measuredStarterDrop").fill("0.35");
    await expect(page.locator("#startingComparisonSummary")).toContainText("within the selected 0.400 V maximum for 50MT");
    await expect(page.locator("#startingComparisonSummary")).toHaveClass(/within/);
    await page.locator("#measuredStarterDrop").fill("0.45");
    await expect(page.locator("#startingComparisonSummary")).toContainText("exceeds the selected 0.400 V maximum for 50MT");
    await expect(page.locator("#startingComparisonSummary")).toHaveClass(/exceeds/);
    await page.locator("#faultSelect").selectOption("FAULT_OPEN_POWER");
    await expect(page.locator("#startingComparisonSummary")).toContainText("not applied to an open circuit");
    await expect(page.locator("#startingComparisonSummary")).toHaveClass(/not-comparable/);
  });

  test("charging preserves reference-only and inapplicable fault boundaries",async({page})=>{
    await page.goto("/dashboard/student/circuit-lab/");
    await expect(page.locator("#chargingComparisonSummary")).toContainText("Source-backed charging reference loaded");
    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_GROUND");
    await expect(page.locator("#chargingComparisonSummary")).toContainText("Not comparable");
    await expect(page.locator("#chargingComparisonSummary")).toHaveClass(/not-comparable/);
    await page.locator("#faultSelect").selectOption("FAULT_OPEN_CHARGE_FEED");
    await expect(page.locator("#chargingComparisonSummary")).toContainText("numeric comparison is unavailable");
    await expect(page.locator("#chargingComparisonSummary")).toHaveClass(/unavailable/);
  });

  test("multi-voltage faults remain domain-aware and non-inferential",async({page})=>{
    await page.goto("/dashboard/student/multivoltage-lab/");
    await page.locator("#engineeringDomainSelect").selectOption("TR400");
    await page.locator("#stateSelect").selectOption("traction-drive-example");
    await page.locator("#faultSelect").selectOption("FAULT_OPEN_TRACTION_FEED");
    await expect(page.locator("#multiVoltageComparisonSummary")).toContainText("numeric healthy-vs-fault comparison is unavailable");
    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_LV_FEED");
    await expect(page.locator("#multiVoltageComparisonSummary")).toContainText("no fault-derived numeric comparison is active");
  });
});
