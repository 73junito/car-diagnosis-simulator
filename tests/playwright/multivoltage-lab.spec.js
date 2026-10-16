const {test,expect}=require("@playwright/test");

test.use({baseURL:"http://127.0.0.1:3003"});

test.describe("electrified multi-voltage lab",()=>{
  test("renders both declared voltage domains and the generic architecture",async({page})=>{
    const errors=[];
    page.on("pageerror",(error)=>errors.push(error.message));
    await page.goto("/dashboard/student/multivoltage-lab/");
    await expect(page.getByRole("heading",{name:"Interactive Electrified Multi-Voltage Lab"})).toBeVisible();
    await expect(page.locator("#voltageProfile")).toContainText("12 V nominal — low-voltage domain");
    await expect(page.locator("#voltageProfile")).toContainText("400 V nominal — training example traction domain");
    await expect(page.locator("#voltageProfile")).toContainText("Electrified vehicle training");
    await expect(page.locator(".component .tm-symbol")).toHaveCount(8);
    await expect(page.locator(".wire[data-style-id]")).toHaveCount(13);
    await expect(page.locator(".test-point")).toHaveCount(5);
    await expect(page.locator(".domain-zone")).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test("traction-drive example keeps voltage-domain flows separated",async({page})=>{
    await page.goto("/dashboard/student/multivoltage-lab/");
    await expect(page.locator(".wire.flow-lv-power")).toHaveCount(2);
    await expect(page.locator(".wire.flow-lv-ground")).toHaveCount(2);
    await expect(page.locator(".wire.flow-control")).toHaveCount(1);
    await expect(page.locator(".wire.flow-traction")).toHaveCount(3);
    await expect(page.locator(".wire.flow-traction-return")).toHaveCount(1);

    await page.locator("#stateSelect").selectOption("dcdc-support");
    await expect(page.locator(".wire.flow-lv-power")).toHaveCount(3);
    await expect(page.locator(".wire.flow-lv-ground")).toHaveCount(3);
    await expect(page.locator(".wire.flow-control")).toHaveCount(0);
    await expect(page.locator(".wire.flow-traction")).toHaveCount(1);
    await expect(page.locator(".wire.flow-traction-return")).toHaveCount(1);
  });

  test("trace controls isolate low-voltage, DC/DC, and traction relationships",async({page})=>{
    await page.goto("/dashboard/student/multivoltage-lab/");
    await page.locator("#stateSelect").selectOption("dcdc-support");

    await page.getByRole("button",{name:"Trace 12 V"}).click();
    await expect(page.locator(".wire.flow-lv-power")).toHaveCount(3);
    await expect(page.locator(".wire.flow-lv-ground")).toHaveCount(3);
    await expect(page.locator(".wire.flow-traction")).toHaveCount(0);

    await page.getByRole("button",{name:"Trace DC/DC relationship"}).click();
    await expect(page.locator(".wire.flow-lv-power")).toHaveCount(1);
    await expect(page.locator(".wire.flow-lv-ground")).toHaveCount(1);
    await expect(page.locator(".wire.flow-traction")).toHaveCount(1);
    await expect(page.locator(".wire.flow-traction-return")).toHaveCount(1);

    await page.locator("#stateSelect").selectOption("traction-drive-example");
    await page.getByRole("button",{name:"Trace traction domain"}).click();
    await expect(page.locator(".wire.flow-lv-power")).toHaveCount(0);
    await expect(page.locator(".wire.flow-traction")).toHaveCount(3);
    await expect(page.locator(".wire.flow-traction-return")).toHaveCount(1);
  });

  test("fault visualization does not collapse the other voltage domain",async({page})=>{
    await page.goto("/dashboard/student/multivoltage-lab/");
    await page.locator("#faultSelect").selectOption("FAULT_OPEN_TRACTION_FEED");
    await expect(page.locator('[data-connection-id="W_HV_INV_POS"]')).toHaveClass(/fault-open/);
    await expect(page.locator('[data-connection-id="W_LV_BAT_FUSE"]')).toHaveClass(/flow-lv-power/);

    await page.locator("#faultSelect").selectOption("FAULT_HIGH_RES_LV_FEED");
    await expect(page.locator('[data-connection-id="W_LV_BAT_FUSE"]')).toHaveClass(/fault-degraded/);
    await expect(page.locator('[data-connection-id="W_HV_INV_POS"]')).toHaveClass(/flow-traction/);
  });

  test("traction-domain test points and training safety boundary are explicit",async({page})=>{
    await page.goto("/dashboard/student/multivoltage-lab/");
    await expect(page.getByText("Conceptual training only.")).toBeVisible();
    await expect(page.getByText(/not a service-procedure simulator/i)).toBeVisible();
    await page.locator('[data-test-point-id="TP_TRACTION_POS"]').click();
    await expect(page.locator("#inspectorContent")).toContainText("Conceptual traction-domain test location for learning only");
    await expect(page.locator("#inspectorContent")).toContainText("No probing or service procedure is provided");
  });

  test("standalone 3D classroom loads governed CadQuery and reusable GLB assets",async({page})=>{
    const errors=[];
    page.on("pageerror",(error)=>errors.push(error.message));
    await page.goto("/dashboard/student/multivoltage-lab/multivoltage-lab-3d.html");
    await expect(page.getByRole("heading",{name:"3D Electrified Multi-Voltage Lab Classroom"})).toBeVisible();
    await expect(page.locator(".asset-card")).toHaveCount(11);
    await expect(page.locator(".asset-status")).toHaveCount(11);
    for(const status of await page.locator(".asset-status").allTextContents()){
      expect(status).toContain("loaded from reusable GLB asset");
    }
    await expect(page.locator("#toolList .tool-item")).toHaveCount(4);
    await expect(page.locator("#testpointList .testpoint-item")).toHaveCount(5);
    await expect(page.locator('[data-test-point-id="TP_TRACTION_POS"]')).toHaveAttribute("data-safety","conceptual-only");
    await expect(page.locator('[data-test-point-id="TP_TRACTION_RETURN"]')).toHaveAttribute("data-safety","conceptual-only");

    await page.locator("#engineeringDomainSelect").selectOption("TR400");
    await page.locator("#domainCurrentInput").fill("10");
    await expect(page.locator("#domainVoltage")).toHaveText("400 V");
    await expect(page.locator("#enteredCurrent")).toHaveText("10 A");
    await expect(page.locator("#calculatedPower")).toHaveText("4.000 kW");

    await page.locator("#faultSelect").selectOption("FAULT_OPEN_TRACTION_FEED");
    await expect(page.locator("#domainStatus")).toContainText("entered current is not inferred from the fault");
    await expect(page.locator("#calculatedPower")).toHaveText("4.000 kW");

    await page.locator("#activeTool").selectOption("tool.current-clamp");
    await expect(page.locator("#toolReading")).toHaveText("Current not inferred");
    await expect(page.locator("#toolReadingNote")).toContainText("calculation input only");

    await page.locator("#activeTool").selectOption("tool.temperature-probe");
    await expect(page.locator("#toolReading")).toHaveText("Temperature not inferred");

    await page.locator("#activeTool").selectOption("tool.scan-tool");
    await expect(page.locator("#toolReading")).toHaveText("Diagnostic PID not inferred");
    expect(errors).toEqual([]);
  });

  test("2D Multivoltage Lab links to the governed 3D classroom",async({page})=>{
    await page.goto("/dashboard/student/multivoltage-lab/");
    await expect(page.getByRole("link",{name:/Open multi-object 3D classroom/i}))
      .toHaveAttribute("href","./multivoltage-lab-3d.html");
  });

  test("student dashboard links to the multi-voltage lab",async({page})=>{
    await page.goto("/dashboard/student/");
    await page.locator('.student-more-tools > summary').click();
    await expect(page.getByRole("link",{name:"Electrified Multi-Voltage Lab"})).toHaveAttribute("href","/dashboard/student/multivoltage-lab/");
  });
});
