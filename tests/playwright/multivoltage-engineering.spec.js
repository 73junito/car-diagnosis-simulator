const { test, expect } = require("@playwright/test");
test.use({baseURL:"http://127.0.0.1:3003"});

test.describe("multi-voltage engineering integration",()=>{
  test("starts with declared 12 V domain and no assumed current",async({page})=>{
    const errors=[]; page.on("pageerror",e=>errors.push(e.message));
    await page.goto("/dashboard/student/multivoltage-lab/");
    await expect(page.locator("#engineeringDomainSelect")).toHaveValue("LV12");
    await expect(page.locator("#engDomainVoltage")).toHaveText("12 V");
    await expect(page.locator("#engDomainCurrent")).toHaveText("—");
    await expect(page.locator("#engDomainPower")).toHaveText("—");
    await expect(page.locator("#multiVoltageEngineeringStatus")).toHaveText("Current not entered");
    expect(errors).toEqual([]);
  });

  test("calculates power only after current is entered",async({page})=>{
    await page.goto("/dashboard/student/multivoltage-lab/");
    await page.locator("#domainCurrentInput").fill("10");
    await expect(page.locator("#engDomainCurrent")).toHaveText("10 A");
    await expect(page.locator("#engDomainPower")).toHaveText("120 W");

    await page.locator("#engineeringDomainSelect").selectOption("TR400");
    await expect(page.locator("#engDomainVoltage")).toHaveText("400 V");
    await expect(page.locator("#engDomainPower")).toHaveText("4.000 kW");
    await expect(page.locator("#engDomainBoundary")).toContainText("not a universal traction voltage");
  });

  test("inactive state and domain faults remain conservative",async({page})=>{
    await page.goto("/dashboard/student/multivoltage-lab/");
    await page.locator("#engineeringDomainSelect").selectOption("TR400");
    await page.locator("#domainCurrentInput").fill("25");
    await page.locator("#stateSelect").selectOption("lv-awake");
    await expect(page.locator("#multiVoltageEngineeringStatus")).toContainText("Domain inactive");

    await page.locator("#stateSelect").selectOption("traction-drive-example");
    await page.locator("#faultSelect").selectOption("FAULT_OPEN_TRACTION_FEED");
    await expect(page.locator("#multiVoltageEngineeringStatus")).toContainText("Selected-domain path open");
    await expect(page.locator("#multiVoltageEngineeringFormula")).toContainText("does not create a measured current");

    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_TRACTION_RETURN");
    await expect(page.locator("#multiVoltageEngineeringStatus")).toContainText("Selected-domain path degraded");
  });

  test("low-voltage faults do not masquerade as traction-domain faults",async({page})=>{
    await page.goto("/dashboard/student/multivoltage-lab/");
    await page.locator("#engineeringDomainSelect").selectOption("TR400");
    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_LV_FEED");
    await expect(page.locator("#multiVoltageEngineeringStatus")).toHaveText("Current not entered");
  });
});
