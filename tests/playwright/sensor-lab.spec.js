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
 test("engineering panel calculates the generic analog transfer example",async({page})=>{
  await page.goto("/dashboard/student/sensor-lab/");
  await expect(page.locator("#sensorEngineeringStatus")).toHaveText("Healthy training example");
  await expect(page.locator("#sensorInputValue")).toHaveText("50%");
  await expect(page.locator("#engSensorReference")).toHaveText("5 V");
  await expect(page.locator("#engSignalRange")).toHaveText("0.5–4.5 V");
  await expect(page.locator("#engIdealSignal")).toHaveText("2.5 V");
  await expect(page.locator("#engObservedSignal")).toHaveText("2.5 V");

  await page.locator("#sensorInput").fill("25");
  await expect(page.locator("#sensorInputValue")).toHaveText("25%");
  await expect(page.locator("#engIdealSignal")).toHaveText("1.5 V");
  await expect(page.locator("#engObservedSignal")).toHaveText("1.5 V");
 });

 test("signal shorts force only the controller-observed training signal",async({page})=>{
  await page.goto("/dashboard/student/sensor-lab/");
  await page.locator("#faultSelect").selectOption("FAULT_SIGNAL_SHORT_GROUND");
  await expect(page.locator("#sensorEngineeringStatus")).toHaveText("Signal short-to-ground training fault");
  await expect(page.locator("#engIdealSignal")).toHaveText("2.5 V");
  await expect(page.locator("#engObservedSignal")).toHaveText("0 V");

  await page.locator("#faultSelect").selectOption("FAULT_SIGNAL_SHORT_POWER");
  await expect(page.locator("#sensorEngineeringStatus")).toHaveText("Signal short-to-reference training fault");
  await expect(page.locator("#engIdealSignal")).toHaveText("2.5 V");
  await expect(page.locator("#engObservedSignal")).toHaveText("5 V");
 });

 test("open and degraded reference faults do not invent sensor output",async({page})=>{
  await page.goto("/dashboard/student/sensor-lab/");
  await page.locator("#faultSelect").selectOption("FAULT_OPEN_SIGNAL");
  await expect(page.locator("#sensorEngineeringStatus")).toHaveText("Signal path open");
  await expect(page.locator("#engIdealSignal")).toHaveText("2.5 V");
  await expect(page.locator("#engObservedSignal")).toHaveText("—");

  await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_SENSOR_GROUND");
  await expect(page.locator("#sensorEngineeringStatus")).toHaveText("Sensor output not inferred");
  await expect(page.locator("#engIdealSignal")).toHaveText("—");
  await expect(page.locator("#engObservedSignal")).toHaveText("—");

  await page.locator("#faultSelect").selectOption("FAULT_OPEN_SENSOR_POWER");
  await expect(page.locator("#sensorEngineeringStatus")).toHaveText("Sensor output not inferred");
  await expect(page.locator("#engIdealSignal")).toHaveText("—");
 });

 test("inactive signal state leaves transfer visible but controller signal unevaluated",async({page})=>{
  await page.goto("/dashboard/student/sensor-lab/");
  await page.locator("#stateSelect").selectOption("key-on-powered");
  await expect(page.locator("#sensorEngineeringStatus")).toHaveText("Signal state inactive");
  await expect(page.locator("#engIdealSignal")).toHaveText("2.5 V");
  await expect(page.locator("#engObservedSignal")).toHaveText("—");
 });

 test("dashboard links to sensor lab",async({page})=>{
  await page.goto("/dashboard/student/");
  await page.locator('.student-more-tools > summary').click();
  await expect(page.getByRole("link",{name:"12 V Sensor Lab"})).toHaveAttribute("href","/dashboard/student/sensor-lab/");
 });
});
