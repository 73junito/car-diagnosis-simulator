const { test, expect } = require("@playwright/test");

test.use({ baseURL: "http://127.0.0.1:3003" });

test.describe("12 V starting-system template lab", () => {
  test("renders contract-driven reference-shell capabilities without changing authority", async ({ page }) => {
    await page.goto("/dashboard/student/starting-system-lab/");

    await expect(page.getByRole("heading", { name: "Available in this lab" })).toBeVisible();
    await expect(page.locator("#labToolList")).toContainText("Dmm");
    await expect(page.locator("#labToolList")).toContainText("Current Clamp");
    await expect(page.locator("#labMeasurementList")).toContainText("Voltage Drop");
    await expect(page.locator("#labMeasurementList")).toContainText("Current");
    await expect(page.locator("#labFaultList")).toContainText("High Resistance");
    await expect(page.locator("#labModelStatus")).toContainText("Electrical Circuit");
    await expect(page.locator("#labModelStatus")).toContainText("Direct practice available");
    await expect(page.locator("#labModelStatus")).toContainText("External Governance Only");
    await expect(page.locator("#labModelStatus")).toContainText("External Human Governance Only");
  });

  test("renders the reusable template with declared voltage and standardized libraries", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dashboard/student/starting-system-lab/");

    await expect(page.getByRole("heading", { name: "Interactive 12 V Starting-System Lab" })).toBeVisible();
    await expect(page.locator("#voltageProfile")).toContainText("12 V nominal");
    await expect(page.locator(".component .tm-symbol")).toHaveCount(7);
    await expect(page.locator(".wire[data-style-id]")).toHaveCount(8);
    await expect(page.locator('.wire[data-voltage-system-id="LV12"]')).toHaveCount(8);
    await expect(page.locator(".test-point")).toHaveCount(4);
    expect(errors).toEqual([]);
  });

  test("crank state shows control, starter power, and ground flow", async ({ page }) => {
    await page.goto("/dashboard/student/starting-system-lab/");
    await expect(page.locator(".wire.flow-control")).toHaveCount(1);
    await expect(page.locator(".wire.flow-power")).toHaveCount(4);
    await expect(page.locator(".wire.flow-ground")).toHaveCount(3);

    await page.locator("#stateSelect").selectOption("key-off");
    await expect(page.locator(".wire.flow-control")).toHaveCount(0);
    await expect(page.locator(".wire.flow-power")).toHaveCount(0);

    await page.locator("#stateSelect").selectOption("crank");
    await expect(page.locator("#stateBadge")).toContainText("Crank request");
  });

  test("open motor power fault interrupts the power path and ground resistance degrades it", async ({ page }) => {
    await page.goto("/dashboard/student/starting-system-lab/");

    await page.locator("#faultSelect").selectOption("FAULT_OPEN_POWER");
    await expect(page.locator('[data-connection-id="W_CONTACT_MOTOR"]')).toHaveClass(/fault-open/);
    await expect(page.locator('[data-connection-id="W_CONTACT_MOTOR"]')).not.toHaveClass(/flow-power/);

    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_GROUND");
    await expect(page.locator('[data-connection-id="W_MOTOR_GND"]')).toHaveClass(/fault-degraded/);
    await expect(page.locator('[data-connection-id="W_MOTOR_GND"]')).toHaveClass(/flow-ground/);
  });

  test("source-backed engineering panel resolves battery and starter references", async ({ page }) => {
    await page.goto("/dashboard/student/starting-system-lab/");
    await expect(page.locator("#batteryReferenceSelect")).toHaveValue("31P-HD");
    await expect(page.locator("#starterFamilySelect")).toHaveValue("50MT");
    await expect(page.locator("#engBatteryCca")).toHaveText("925 A");
    await expect(page.locator("#engBatteryCa")).toHaveText("1110 A");
    await expect(page.locator("#engBatteryRc")).toHaveText("180 min");
    await expect(page.locator("#engBatteryAh")).toHaveText("104 Ah");
    await expect(page.locator("#engStarterTestCurrent")).toHaveText("500 A");
    await expect(page.locator("#engStarterDropLimit")).toHaveText("0.400 V max");
    await expect(page.locator("#engCableResistanceLimit")).toHaveText("0.800 mΩ");

    await page.locator("#starterFamilySelect").selectOption("37MT");
    await expect(page.locator("#engStarterDropLimit")).toHaveText("0.500 V max");
    await expect(page.locator("#engCableResistanceLimit")).toHaveText("1.000 mΩ");

    await page.locator("#batteryReferenceSelect").selectOption("31P-AGM71");
    await expect(page.locator("#engBatteryCa")).toHaveText("1155 A");
    await expect(page.locator("#engBatteryRc")).toHaveText("200 min");
    await expect(page.locator("#engBatteryAh")).toHaveText("100 Ah");
  });

  test("starting engineering panel keeps fault behavior conservative", async ({ page }) => {
    await page.goto("/dashboard/student/starting-system-lab/");
    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_POWER");
    await expect(page.locator("#startingEngineeringStatus")).toContainText("High-resistance path");
    await page.locator("#faultSelect").selectOption("FAULT_OPEN_POWER");
    await expect(page.locator("#startingEngineeringStatus")).toContainText("Open circuit");
    await expect(page.locator("#startingEngineeringFormula")).toContainText("does not assert product compatibility");
  });

  test("standalone 3D classroom loads governed Starting System assets without bypassing review gates", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/dashboard/student/starting-system-lab/starting-system-lab-3d.html");
    await expect(page.getByRole("heading", { name: "3D Starting System Lab Classroom" })).toBeVisible();
    await expect(page.locator(".asset-card")).toHaveCount(9);
    await expect(page.locator("#toolList .tool-item")).toHaveCount(2);
    await expect(page.locator("#testPointList .testpoint-item")).toHaveCount(4);
    await expect(page.locator("#stateList .contract-item")).toHaveCount(3);
    await expect(page.locator("#faultList .contract-item")).toHaveCount(4);

    for (const status of await page.locator(".asset-status").allTextContents()) {
      expect(status).toContain("loaded from reusable GLB asset");
    }

    await expect(page.locator('[data-test-point-id="TP_SOLENOID_OUT"]')).toContainText("SOL_CONTACT_MOTOR");
    await expect(page.locator("body")).not.toContainText("starting-system-voltage-drop-review.glb");
    expect(errors).toEqual([]);
  });

  test("3D classroom canvases are keyboard operable and mobile-contained", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/student/starting-system-lab/starting-system-lab-3d.html");

    const canvas = page.locator(".asset-canvas").first();
    await expect(canvas).toHaveAttribute("aria-label", /Interactive 3D model:/);
    await canvas.focus();
    await expect(canvas).toBeFocused();
    await canvas.press("ArrowRight");
    await canvas.press("+");

    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      canvasWidth: document.querySelector(".asset-canvas").getBoundingClientRect().width
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(dimensions.canvasWidth).toBeLessThanOrEqual(dimensions.viewport);
  });

  test("2D Starting System Lab links to the presentation-only 3D classroom", async ({ page }) => {
    await page.goto("/dashboard/student/starting-system-lab/");
    await expect(page.getByRole("link", { name: /Open multi-object 3D classroom/i }))
      .toHaveAttribute("href", "./starting-system-lab-3d.html");
  });

  test("student dashboard exposes the starting-system lab", async ({ page }) => {
    await page.goto("/dashboard/student/");
  await page.locator('.student-more-tools > summary').click();
    await expect(page.getByRole("link", { name: "12 V Starting Lab" })).toHaveAttribute(
      "href",
      "/dashboard/student/starting-system-lab/"
    );
  });
});
