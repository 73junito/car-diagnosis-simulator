const {test,expect}=require("@playwright/test");
test.use({baseURL:"http://127.0.0.1:3003"});
test.describe("12 V three-wire sensor lab",()=>{
 test("renders contract-driven reference-shell capabilities without changing authority",async({page})=>{
  await page.goto("/dashboard/student/sensor-lab/");
  await expect(page.getByRole("heading",{name:"Available in this lab"})).toBeVisible();
  await expect(page.locator("#labToolList")).toContainText("Dmm");
  await expect(page.locator("#labToolList")).toContainText("Oscilloscope");
  await expect(page.locator("#labToolList")).toContainText("Scan Tool");
  await expect(page.locator("#labMeasurementList")).toContainText("Waveform");
  await expect(page.locator("#labMeasurementList")).toContainText("Diagnostic Data");
  await expect(page.locator("#labFaultList")).toContainText("Short To Ground");
  await expect(page.locator("#labFaultList")).toContainText("Short To Power");
  await expect(page.locator("#labModelStatus")).toContainText("Electrical Circuit");
  await expect(page.locator("#labModelStatus")).toContainText("Direct practice available");
  await expect(page.locator("#labModelStatus")).toContainText("External Governance Only");
  await expect(page.locator("#labModelStatus")).toContainText("External Human Governance Only");
 });

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

 test("3D classroom mirrors runtime-enabled tools, test points, values, and faults",async({page})=>{
  await page.goto("/dashboard/student/sensor-lab/");

  await expect(page.getByRole("heading",{name:"Sensor test equipment and runtime bindings"})).toBeVisible();
  await expect(page.locator('[data-asset-id="equipment.dmm"]')).toHaveAttribute("data-enabled","true");
  await expect(page.locator('[data-asset-id="equipment.oscilloscope"]')).toHaveAttribute("data-enabled","true");
  await expect(page.locator('[data-asset-id="equipment.current-clamp"]')).toHaveAttribute("data-enabled","false");

  await expect(page.locator("#sensor3dTestPoint option")).toHaveCount(4);
  await expect(page.locator("#sensor3dBindingValue")).toHaveText("5 V");
  await page.locator("#sensor3dTestPoint").selectOption("TP_ECM_SIGNAL");
  await expect(page.locator("#sensor3dBindingValue")).toHaveText("2.5 V");

  await page.locator("#sensorInput").fill("25");
  await expect(page.locator("#engObservedSignal")).toHaveText("1.5 V");
  await expect(page.locator("#sensor3dBindingValue")).toHaveText("1.5 V");

  await page.locator("#faultSelect").selectOption("FAULT_SIGNAL_SHORT_GROUND");
  await expect(page.locator("#engObservedSignal")).toHaveText("0 V");
  await expect(page.locator("#sensor3dBindingValue")).toHaveText("0 V");
  await expect(page.locator("#sensor3dFaultState")).toContainText("Sensor signal short to ground");

  await page.locator("#sensor3dTestPoint").selectOption("TP_SENSOR_GROUND");
  await expect(page.locator("#sensor3dBindingValue")).toContainText("No numeric value inferred");
  await expect(page.locator("#sensor3dProbeState")).toContainText("TP_SENSOR_GROUND");
 });

 test("standalone multi-object classroom preserves Sensor and ECM signal authority",async({page})=>{
  await page.goto("/dashboard/student/sensor-lab/sensor-lab-3d.html");
  await expect(page.getByRole("heading",{name:"3D Sensor Lab Classroom"})).toBeVisible();
  await expect(page.locator('[data-tool-id="tool.dmm"]')).toHaveAttribute("data-enabled","true");
  await expect(page.locator('[data-tool-id="tool.oscilloscope"]')).toHaveAttribute("data-enabled","true");
  await expect(page.locator('[data-tool-id="tool.current-clamp"]')).toHaveAttribute("data-enabled","false");
  await expect(page.locator("#testpointList .testpoint-item")).toHaveCount(4);
  await expect(page.locator('#testpointList [data-test-point-id="TP_SENSOR_SIGNAL"] .tp-value')).toHaveText("2.5 V");
  await expect(page.locator('#testpointList [data-test-point-id="TP_ECM_SIGNAL"] .tp-value')).toHaveText("2.5 V");

  await page.locator("#faultSelect").selectOption("FAULT_SIGNAL_SHORT_GROUND");
  await expect(page.locator('#testpointList [data-test-point-id="TP_SENSOR_SIGNAL"] .tp-value')).toHaveText("2.5 V");
  await expect(page.locator('#testpointList [data-test-point-id="TP_ECM_SIGNAL"] .tp-value')).toHaveText("0 V");

  await expect(page.locator('#testpointList [data-test-point-id="TP_SENSOR_GROUND"] .tp-value')).toContainText("No numeric value inferred");
  await page.locator("#probeRedTarget").selectOption("TP_ECM_SIGNAL");
  await page.locator("#dockRed").click();
  await expect(page.locator("#probeStatus")).toContainText("Controller-observed signal");
  await expect(page.locator("#dmmReading")).toHaveText("0 V");
 });

 test("dashboard links to sensor lab",async({page})=>{
  await page.goto("/dashboard/student/");
  await page.locator('.student-more-tools > summary').click();
  await expect(page.getByRole("link",{name:"12 V Sensor Lab"})).toHaveAttribute("href","/dashboard/student/sensor-lab/");
 });
});
