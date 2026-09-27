const { test, expect } = require("@playwright/test");

test.use({ baseURL:"http://127.0.0.1:3003" });

test.describe("measured-value student-entry layer",()=>{
  test("relay measurement records a delta from the training calculation",async({page})=>{
    await page.goto("/dashboard/student/relay-load-lab/");
    await expect(page.locator("#relayMeasurementResult")).toHaveText("No measurement entered");
    await page.locator("#measuredRelayCurrent").fill("2");
    await expect(page.locator("#relayMeasurementResult")).toContainText("Recorded 2 A");
    await expect(page.locator("#relayMeasurementResult")).toContainText("Δ vs training calculation");
  });

  test("sensor measurement records a delta from the training ideal",async({page})=>{
    await page.goto("/dashboard/student/sensor-lab/");
    await page.locator("#measuredSensorSignal").fill("2.7");
    await expect(page.locator("#sensorMeasurementResult")).toContainText("Recorded 2.7 V");
    await expect(page.locator("#sensorMeasurementResult")).toContainText("+0.200 V");
    await page.locator("#faultSelect").selectOption("FAULT_OPEN_SENSOR_POWER");
    await expect(page.locator("#sensorMeasurementResult")).toContainText("training ideal unavailable");
  });

  test("actuator measurement records a delta without diagnosing response",async({page})=>{
    await page.goto("/dashboard/student/actuator-lab/");
    await page.locator("#measuredActuatorAverage").fill("3.9");
    await expect(page.locator("#actuatorMeasurementResult")).toContainText("Recorded 3.9 V");
    await expect(page.locator("#actuatorMeasurementResult")).toContainText("+0.300 V");
  });

  test("starting-system measurement compares only to the selected authoritative maximum",async({page})=>{
    await page.goto("/dashboard/student/starting-system-lab/");
    await page.locator("#measuredStarterDrop").fill("0.35");
    await expect(page.locator("#startingMeasurementResult")).toContainText("within selected 50MT source reference");
    await expect(page.locator("#startingMeasurementResult")).toHaveClass(/within/);

    await page.locator("#measuredStarterDrop").fill("0.45");
    await expect(page.locator("#startingMeasurementResult")).toContainText("exceeds selected 50MT source reference");
    await expect(page.locator("#startingMeasurementResult")).toHaveClass(/exceeds/);

    await page.locator("#starterFamilySelect").selectOption("37MT");
    await expect(page.locator("#startingMeasurementResult")).toContainText("within selected 37MT source reference");

    await page.locator("#faultSelect").selectOption("FAULT_OPEN_POWER");
    await expect(page.locator("#startingMeasurementResult")).toContainText("comparison not applied to an open circuit");
  });

  test("charging current is a measured-value input before resistance calculation",async({page})=>{
    await page.goto("/dashboard/student/circuit-lab/");
    await page.locator("#chargingCurrentInput").fill("100");
    await expect(page.locator("#engChargingCurrent")).toHaveText("100 A");
    await expect(page.locator("#engChargingResistance")).toHaveText("3.000 mΩ");
    await expect(page.locator("#chargingEngineeringFormula")).toContainText("Measured-value entry 100 A");
  });

  test("multi-voltage current is a measured-value input and does not change the declared voltage role",async({page})=>{
    await page.goto("/dashboard/student/multivoltage-lab/");
    await page.locator("#domainCurrentInput").fill("10");
    await expect(page.locator("#engDomainCurrent")).toHaveText("10 A");
    await expect(page.locator("#engDomainPower")).toHaveText("120 W");
    await expect(page.locator("#multiVoltageEngineeringFormula")).toContainText("measured 10 A");

    await page.locator("#engineeringDomainSelect").selectOption("TR400");
    await expect(page.locator("#engDomainVoltage")).toHaveText("400 V");
    await expect(page.locator("#engDomainBoundary")).toContainText("training example");
    await expect(page.locator("#engDomainPower")).toHaveText("4.000 kW");
  });
});
