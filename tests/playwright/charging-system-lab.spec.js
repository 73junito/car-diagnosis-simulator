const { test, expect } = require("@playwright/test");

test.use({ baseURL:"http://127.0.0.1:3003" });

test.describe("charging-system engineering integration",()=>{
  test("loads source-backed design reference without assuming current",async({page})=>{
    const errors=[]; page.on("pageerror",e=>errors.push(e.message));
    await page.goto("/dashboard/student/circuit-lab/");
    await expect(page.locator("#chargingEngineeringStatus")).toHaveText("Reference loaded");
    await expect(page.locator("#chargingReferenceSelect")).toHaveValue("delco-charging-cable-new-vehicle-design-drop-12v");
    await expect(page.locator("#engChargingDrop")).toHaveText("0.300 V");
    await expect(page.locator("#engChargingCurrent")).toHaveText("—");
    await expect(page.locator("#engChargingResistance")).toHaveText("—");
    await expect(page.locator("#chargingEngineeringFormula")).toContainText("Enter a positive current value");
    expect(errors).toEqual([]);
  });

  test("calculates equivalent resistance only after current is entered",async({page})=>{
    await page.goto("/dashboard/student/circuit-lab/");
    await page.locator("#chargingCurrentInput").fill("100");
    await expect(page.locator("#engChargingCurrent")).toHaveText("100 A");
    await expect(page.locator("#engChargingResistance")).toHaveText("3.000 mΩ");

    await page.locator("#chargingReferenceSelect").selectOption("delco-charging-cable-life-max-drop-12v");
    await expect(page.locator("#engChargingDrop")).toHaveText("0.500 V");
    await expect(page.locator("#engChargingResistance")).toHaveText("5.000 mΩ");

    await page.locator("#chargingReferenceSelect").selectOption("delco-charging-3wire-number2-lead-max-drop-12v");
    await expect(page.locator("#engChargingDrop")).toHaveText("0.200 V");
    await expect(page.locator("#engChargingResistance")).toHaveText("2.000 mΩ");
    await expect(page.locator("#engChargingDropLabel")).toHaveText("3-wire #2 lead maximum");
  });

  test("fault messaging does not fabricate charging measurements",async({page})=>{
    await page.goto("/dashboard/student/circuit-lab/");
    await page.locator("#chargingCurrentInput").fill("100");

    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_GROUND");
    await expect(page.locator("#chargingEngineeringStatus")).toContainText("selected cable reference may not apply");
    await expect(page.locator("#chargingEngineeringFormula")).toContainText("different path");
    await expect(page.locator("#engChargingResistance")).toHaveText("3.000 mΩ");

    await page.locator("#faultSelect").selectOption("FAULT_OPEN_CHARGE_FEED");
    await expect(page.locator("#chargingEngineeringStatus")).toContainText("Open path");
    await expect(page.locator("#chargingEngineeringFormula")).toContainText("does not receive a fabricated voltage-drop value");

    await page.locator("#faultSelect").selectOption("FAULT_OPEN_PROTECTION");
    await expect(page.locator("#chargingEngineeringStatus")).toContainText("Open path");
  });

  test("changing operating state does not invent charging voltage or current",async({page})=>{
    await page.goto("/dashboard/student/circuit-lab/");
    await page.locator("#stateSelect").selectOption("key-off");
    await expect(page.locator("#engChargingDrop")).toHaveText("0.300 V");
    await expect(page.locator("#engChargingCurrent")).toHaveText("—");
    await expect(page.locator("#engChargingResistance")).toHaveText("—");
  });
});
