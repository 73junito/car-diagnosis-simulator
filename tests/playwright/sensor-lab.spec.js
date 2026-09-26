const {test,expect}=require("@playwright/test");
test.use({baseURL:"http://127.0.0.1:3003"});
test.describe("12 V three-wire sensor lab",()=>{
 test("renders explicit 12 V and 5 V domains",async({page})=>{
  const errors=[]; page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/dashboard/student/sensor-lab/");
  await expect(page.getByRole("heading",{name:"Interactive 12 V Three-Wire Sensor Lab"})).toBeVisible();
  await expect(page.locator("#voltageProfile")).toContainText("12 V nominal");
  await expect(page.locator("#voltageProfile")).toContainText("5 V nominal training reference");
  await expect(page.locator(".component .tm-symbol")).toHaveCount(6);
  await expect(page.locator(".wire[data-style-id]")).toHaveCount(8);
  await expect(page.locator(".test-point")).toHaveCount(4);
  expect(errors).toEqual([]);
 });
 test("active state shows supply, signal, and ground flow",async({page})=>{
  await page.goto("/dashboard/student/sensor-lab/");
  await expect(page.locator(".wire.flow-power")).toHaveCount(4);
  await expect(page.locator(".wire.flow-signal")).toHaveCount(1);
  await expect(page.locator(".wire.flow-ground")).toHaveCount(3);
 });
 test("short-to-ground and high-resistance ground are visible",async({page})=>{
  await page.goto("/dashboard/student/sensor-lab/");
  await page.locator("#faultSelect").selectOption("FAULT_SIGNAL_SHORT_GROUND");
  await expect(page.locator('[data-fault-short-id="FAULT_SIGNAL_SHORT_GROUND"]')).toHaveCount(1);
  await expect(page.locator('[data-connection-id="W_SENSOR_SIGNAL"]')).toHaveClass(/fault-short/);
  await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_SENSOR_GROUND");
  await expect(page.locator('[data-connection-id="W_SENSOR_GND"]')).toHaveClass(/fault-degraded/);
 });
 test("dashboard links to sensor lab",async({page})=>{
  await page.goto("/dashboard/student/");
  await expect(page.getByRole("link",{name:"12 V Sensor Lab"})).toHaveAttribute("href","/dashboard/student/sensor-lab/");
 });
});
