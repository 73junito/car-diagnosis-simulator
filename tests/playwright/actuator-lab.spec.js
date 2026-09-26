const {test,expect}=require("@playwright/test");
test.use({baseURL:"http://127.0.0.1:3003"});
test.describe("12 V PWM actuator lab",()=>{
 test("renders standardized actuator with explicit 12 V domain",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/dashboard/student/actuator-lab/");
  await expect(page.getByRole("heading",{name:"Interactive 12 V PWM-Controlled Actuator Lab"})).toBeVisible();
  await expect(page.locator("#voltageProfile")).toContainText("12 V nominal");
  await expect(page.locator(".component .tm-symbol")).toHaveCount(5);
  await expect(page.locator(".wire[data-style-id]")).toHaveCount(7);
  await expect(page.locator(".test-point")).toHaveCount(4);
  expect(errors).toEqual([]);
 });
 test("PWM state separates power, command, and ground",async({page})=>{
  await page.goto("/dashboard/student/actuator-lab/");
  await expect(page.locator(".wire.flow-power")).toHaveCount(3);
  await expect(page.locator(".wire.flow-control")).toHaveCount(1);
  await expect(page.locator(".wire.flow-ground")).toHaveCount(3);
  await page.locator("#stateSelect").selectOption("actuator-inactive");
  await expect(page.locator(".wire.flow-control")).toHaveCount(0);
 });
 test("PWM short and ground resistance are visible",async({page})=>{
  await page.goto("/dashboard/student/actuator-lab/");
  await page.locator("#faultSelect").selectOption("FAULT_PWM_SHORT_GROUND");
  await expect(page.locator('[data-fault-short-id="FAULT_PWM_SHORT_GROUND"]')).toHaveCount(1);
  await expect(page.locator('[data-connection-id="W_ECM_PWM"]')).toHaveClass(/fault-short/);
  await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_ACT_GROUND");
  await expect(page.locator('[data-connection-id="W_ACT_GND"]')).toHaveClass(/fault-degraded/);
 });
 test("dashboard links to actuator lab",async({page})=>{
  await page.goto("/dashboard/student/");
  await expect(page.getByRole("link",{name:"12 V PWM Actuator Lab"})).toHaveAttribute("href","/dashboard/student/actuator-lab/");
 });
});