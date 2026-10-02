const {test,expect}=require("@playwright/test");
test.use({baseURL:"http://127.0.0.1:3003"});
test.describe("12 V CAN/LIN network lab",()=>{
 test("renders generic network topology and explicit 12 V domain",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/dashboard/student/network-lab/");
  await expect(page.getByRole("heading",{name:"Interactive 12 V CAN/LIN Network Lab"})).toBeVisible();
  await expect(page.locator("#voltageProfile")).toContainText("12 V nominal");
  await expect(page.locator(".component .tm-symbol")).toHaveCount(7);
  await expect(page.locator(".wire[data-style-id]")).toHaveCount(15);
  await expect(page.locator(".test-point")).toHaveCount(5);
  expect(errors).toEqual([]);
 });
 test("combined state distinguishes CAN, LIN, power, and ground",async({page})=>{
  await page.goto("/dashboard/student/network-lab/");
  await expect(page.locator(".wire.flow-power")).toHaveCount(5);
  await expect(page.locator(".wire.flow-ground")).toHaveCount(5);
  await expect(page.locator(".wire.flow-can")).toHaveCount(4);
  await expect(page.locator(".wire.flow-lin")).toHaveCount(1);
  await page.locator("#stateSelect").selectOption("can-active");
  await expect(page.locator(".wire.flow-can")).toHaveCount(4);
  await expect(page.locator(".wire.flow-lin")).toHaveCount(0);
 });
 test("line short and LIN short render explicit fault paths",async({page})=>{
  await page.goto("/dashboard/student/network-lab/");
  await page.locator("#faultSelect").selectOption("FAULT_CAN_LINES_SHORTED");
  await expect(page.locator('[data-fault-short-id="FAULT_CAN_LINES_SHORTED"]')).toHaveCount(1);
  await page.locator("#faultSelect").selectOption("FAULT_LIN_SHORT_GROUND");
  await expect(page.locator('[data-fault-short-id="FAULT_LIN_SHORT_GROUND"]')).toHaveCount(1);
 });
 test("dashboard links to network lab",async({page})=>{
  await page.goto("/dashboard/student/");
  await page.locator('.student-more-tools > summary').click();
  await expect(page.getByRole("link",{name:"12 V CAN/LIN Network Lab"})).toHaveAttribute("href","/dashboard/student/network-lab/");
 });
});