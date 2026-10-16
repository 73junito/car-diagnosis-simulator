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
 test("engineering panel calculates PWM command examples",async({page})=>{
  await page.goto("/dashboard/student/actuator-lab/");
  await expect(page.locator("#actuatorEngineeringStatus")).toHaveText("Healthy training example");
  await expect(page.locator("#dutyInputValue")).toHaveText("30%");
  await expect(page.locator("#engActuatorSupply")).toHaveText("12 V");
  await expect(page.locator("#engDutyCycle")).toHaveText("30%");
  await expect(page.locator("#engIdealAverage")).toHaveText("3.6 V");
  await expect(page.locator("#engObservedCommand")).toHaveText("3.6 V avg");

  await page.locator("#dutyInput").fill("40");
  await expect(page.locator("#dutyInputValue")).toHaveText("40%");
  await expect(page.locator("#engIdealAverage")).toHaveText("4.8 V");
  await expect(page.locator("#engObservedCommand")).toHaveText("4.8 V avg");

  await page.locator("#stateSelect").selectOption("pwm-high-example");
  await expect(page.locator("#dutyInputValue")).toHaveText("70%");
  await expect(page.locator("#engIdealAverage")).toHaveText("8.4 V");
 });

 test("PWM faults change actuator-side observation conservatively",async({page})=>{
  await page.goto("/dashboard/student/actuator-lab/");
  await page.locator("#faultSelect").selectOption("FAULT_PWM_SHORT_GROUND");
  await expect(page.locator("#actuatorEngineeringStatus")).toHaveText("PWM short-to-ground training fault");
  await expect(page.locator("#engIdealAverage")).toHaveText("3.6 V");
  await expect(page.locator("#engObservedCommand")).toHaveText("0 V avg");

  await page.locator("#faultSelect").selectOption("FAULT_PWM_SHORT_POWER");
  await expect(page.locator("#actuatorEngineeringStatus")).toHaveText("PWM short-to-power training fault");
  await expect(page.locator("#engObservedCommand")).toHaveText("12 V avg");

  await page.locator("#faultSelect").selectOption("FAULT_OPEN_PWM");
  await expect(page.locator("#actuatorEngineeringStatus")).toHaveText("Actuator-side PWM unavailable");
  await expect(page.locator("#engIdealAverage")).toHaveText("3.6 V");
  await expect(page.locator("#engObservedCommand")).toHaveText("—");
 });

 test("power and ground faults preserve command math without inventing actuator response",async({page})=>{
  await page.goto("/dashboard/student/actuator-lab/");
  await page.locator("#faultSelect").selectOption("FAULT_OPEN_ACT_POWER");
  await expect(page.locator("#engPowerAvailability")).toHaveText("Unavailable");
  await expect(page.locator("#engObservedCommand")).toHaveText("3.6 V avg");
  await expect(page.locator("#actuatorEngineeringFormula")).toContainText("actuator response is not inferred");

  await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_ACT_GROUND");
  await expect(page.locator("#engGroundAvailability")).toHaveText("Degraded");
  await expect(page.locator("#engObservedCommand")).toHaveText("3.6 V avg");
  await expect(page.locator("#actuatorEngineeringFormula")).toContainText("No voltage drop or actuator response is invented");
 });

 test("inactive state resets duty command and leaves actuator-side command unevaluated",async({page})=>{
  await page.goto("/dashboard/student/actuator-lab/");
  await page.locator("#stateSelect").selectOption("actuator-inactive");
  await expect(page.locator("#dutyInputValue")).toHaveText("0%");
  await expect(page.locator("#engIdealAverage")).toHaveText("0 V");
  await expect(page.locator("#engObservedCommand")).toHaveText("—");
  await expect(page.locator("#actuatorEngineeringStatus")).toHaveText("PWM command inactive");
 });

 test("reference shell mirrors runtime capabilities without creating authority",async({page})=>{
  await page.goto("/dashboard/student/actuator-lab/");
  await expect(page.locator("#labToolList li")).toHaveCount(4);
  await expect(page.locator("#labToolList")).toContainText("Dmm");
  await expect(page.locator("#labToolList")).toContainText("Oscilloscope");
  await expect(page.locator("#labToolList")).toContainText("Scan Tool");
  await expect(page.locator("#labToolList")).toContainText("Current Clamp");
  await expect(page.locator("#labMeasurementList")).toContainText("Duty Cycle");
  await expect(page.locator("#labMeasurementList")).toContainText("Frequency");
  await expect(page.locator("#labMeasurementList")).toContainText("Current");
  await expect(page.locator("#labFaultList li")).toHaveCount(4);
  await expect(page.locator("#labModelStatus")).toContainText("Direct practice available");
  await expect(page.locator("#labModelStatus")).toContainText("External Governance Only");
  await expect(page.locator("#labModelStatus")).toContainText("External Human Governance Only");
  await expect(page.getByText("Duty cycle does not establish actuator position, speed, force, flow, current, or frequency.")).toBeVisible();
 });

 test("standalone multi-object 3D classroom uses real GLBs without creating engineering truth",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/dashboard/student/actuator-lab/actuator-lab-3d.html");
  await expect(page.getByRole("heading",{name:"3D Actuator Lab Classroom"})).toBeVisible();
  await expect(page.locator(".asset-card")).toHaveCount(9);
  await expect(page.locator('[data-asset-id="component.generic-actuator"] .asset-status')).toContainText("loaded from reusable GLB asset");
  await expect(page.locator("#toolList .tool-item")).toHaveCount(4);
  await expect(page.locator("#toolList")).toContainText("Scan Tool");
  await expect(page.locator("#toolList")).toContainText("no dedicated 3D asset");
  await expect(page.locator("#testpointList .testpoint-item")).toHaveCount(4);
  await expect(page.locator("#ecmCommandValue")).toHaveText("3.6 V avg");
  await expect(page.locator("#actuatorCommandValue")).toHaveText("3.6 V avg");

  await page.locator("#faultSelect").selectOption("FAULT_PWM_SHORT_GROUND");
  await expect(page.locator("#ecmCommandValue")).toHaveText("3.6 V avg");
  await expect(page.locator("#actuatorCommandValue")).toHaveText("0 V avg");

  await page.locator("#activeTool").selectOption("tool.current-clamp");
  await expect(page.locator("#toolReading")).toHaveText("Current not inferred");
  await expect(page.locator("#toolReadingNote")).toContainText("no authoritative load/current model");
  expect(errors).toEqual([]);
 });

 test("2D Actuator Lab links to the governed 3D classroom",async({page})=>{
  await page.goto("/dashboard/student/actuator-lab/");
  await expect(page.getByRole("link",{name:/Open multi-object 3D classroom/i}))
   .toHaveAttribute("href","./actuator-lab-3d.html");
 });

 test("dashboard links to actuator lab",async({page})=>{
  await page.goto("/dashboard/student/");
  await page.locator('.student-more-tools > summary').click();
  await expect(page.getByRole("link",{name:"12 V PWM Actuator Lab"})).toHaveAttribute("href","/dashboard/student/actuator-lab/");
 });
});