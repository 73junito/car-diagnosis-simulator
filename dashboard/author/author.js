(function () {
  const validateButton = document.getElementById("validateScenarioBtn");
  const saveButton = document.getElementById("saveDraftBtn");
  const exportButton = document.getElementById("exportDraftBtn");
  const importButton = document.getElementById("importDraftBtn");
  const importInput = document.getElementById("importScenarioInput");
  const validationStatus = document.getElementById("validationStatus");
  const checklist = document.getElementById("validationChecklist");
  const jsonPreview = document.getElementById("scenarioJsonPreview");

  const fields = {
    title: document.getElementById("scenarioTitle"),
    complaint: document.getElementById("customerComplaintInput"),
    year: document.getElementById("vehicleYear"),
    make: document.getElementById("vehicleMake"),
    model: document.getElementById("vehicleModel"),
    engine: document.getElementById("vehicleEngine"),
    mileage: document.getElementById("vehicleMileage"),
    system: document.getElementById("vehicleSystem"),
    primaryDtc: document.getElementById("primaryDtc"),
    dtcDescription: document.getElementById("dtcDescription"),
    freezeFrame: document.getElementById("freezeFrameSummary"),
    rpm: document.getElementById("pidRpm"),
    voltage: document.getElementById("pidVoltage"),
    coolant: document.getElementById("pidCoolant"),
    fuelTrim: document.getElementById("pidFuelTrim"),
    initialTest: document.getElementById("initialTestStep"),
    expectedFinding: document.getElementById("expectedFinding"),
    rootCause: document.getElementById("rootCause"),
    recommendedRepair: document.getElementById("recommendedRepair"),
    aseArea: document.getElementById("aseArea"),
    safetyCriteria: document.getElementById("safetyCriteria"),
    diagnosticCriteria: document.getElementById("diagnosticCriteria"),
    verificationCriteria: document.getElementById("verificationCriteria")
  };

  const preview = {
    title: document.getElementById("previewTitle"),
    complaint: document.getElementById("previewComplaint"),
    vehicle: document.getElementById("previewVehicle"),
    dtcs: document.getElementById("previewDtcs"),
    liveData: document.getElementById("previewLiveData"),
    ase: document.getElementById("previewAse")
  };

  function value(field) {
    return field && field.value ? field.value.trim() : "";
  }

  function slugify(text) {
    return (text || "untitled-scenario")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "untitled-scenario";
  }

  function buildScenario() {
    return {
      id: slugify(value(fields.title)),
      status: "draft",
      title: value(fields.title),
      vehicle: {
        year: value(fields.year),
        make: value(fields.make),
        model: value(fields.model),
        engine: value(fields.engine),
        mileage: value(fields.mileage),
        system: value(fields.system)
      },
      complaint: {
        customer: value(fields.complaint)
      },
      evidence: {
        dtcs: value(fields.primaryDtc) ? [{
          code: value(fields.primaryDtc),
          description: value(fields.dtcDescription)
        }] : [],
        freezeFrame: value(fields.freezeFrame),
        liveData: {
          rpm: value(fields.rpm),
          voltage: value(fields.voltage),
          coolant: value(fields.coolant),
          fuelTrim: value(fields.fuelTrim)
        }
      },
      diagnosticPath: {
        initialTest: value(fields.initialTest),
        expectedFinding: value(fields.expectedFinding),
        rootCause: value(fields.rootCause),
        recommendedRepair: value(fields.recommendedRepair)
      },
      rubric: {
        aseArea: value(fields.aseArea),
        safety: value(fields.safetyCriteria),
        diagnosis: value(fields.diagnosticCriteria),
        verification: value(fields.verificationCriteria)
      }
    };
  }

  function getValidationItems() {
    return [
      ["Vehicle year, make, and model", value(fields.year) && value(fields.make) && value(fields.model)],
      ["Scenario title and customer complaint", value(fields.title) && value(fields.complaint)],
      ["Evidence: DTC or live data", value(fields.primaryDtc) || value(fields.rpm) || value(fields.voltage)],
      ["Diagnostic path and root cause", value(fields.initialTest) && value(fields.rootCause) && value(fields.recommendedRepair)],
      ["ASE area and diagnostic rubric", value(fields.aseArea) && value(fields.diagnosticCriteria)]
    ];
  }

  function setStatus(message) {
    if (validationStatus) validationStatus.textContent = message;
  }

  function renderChecklist(items) {
    if (!checklist) return;

    checklist.innerHTML = items.map(([label, valid]) => `
      <li data-valid="${Boolean(valid)}">${valid ? "✓" : "•"} ${label}</li>
    `).join("");
  }

  function renderJsonPreview() {
    if (jsonPreview) {
      jsonPreview.value = JSON.stringify(buildScenario(), null, 2);
    }
  }

  function seedDemoData() {
    const demoValues = {
      title: "No-start after overnight soak",
      complaint: "Customer states the vehicle cranks but will not start after sitting overnight.",
      year: "2018",
      make: "Ford",
      model: "F-150",
      engine: "5.0L V8",
      mileage: "84200",
      system: "Engine Performance",
      primaryDtc: "P0335",
      dtcDescription: "Crankshaft Position Sensor A Circuit",
      freezeFrame: "RPM 0, ECT 42°F, battery voltage 12.1V during crank.",
      rpm: "0",
      voltage: "12.1",
      coolant: "42°F",
      fuelTrim: "+18%",
      initialTest: "Verify crank signal while cranking",
      expectedFinding: "No RPM signal during crank",
      rootCause: "Failed crankshaft position sensor",
      recommendedRepair: "Replace crankshaft position sensor, clear codes, and verify restart.",
      aseArea: "A8 Engine Performance",
      safetyCriteria: "Uses safe test procedures and avoids unnecessary part replacement.",
      diagnosticCriteria: "Uses evidence to isolate the fault before repair.",
      verificationCriteria: "Confirms repair with restart, code clear, and no returning faults."
    };

    Object.entries(demoValues).forEach(([key, demoValue]) => {
      const field = fields[key];
      if (field && !value(field)) field.value = demoValue;
    });
  }
  function renderPreview() {
    const title = value(fields.title);
    const complaint = value(fields.complaint);

    const vehicleParts = [
      value(fields.year),
      value(fields.make),
      value(fields.model),
      value(fields.engine)
    ].filter(Boolean);

    const mileage = value(fields.mileage);
    const system = value(fields.system);

    if (preview.title) {
      preview.title.textContent = title || "Untitled Diagnostic Scenario";
    }

    if (preview.complaint) {
      preview.complaint.textContent = complaint || "Add a customer complaint to preview how students will see the scenario.";
    }

    if (preview.vehicle) {
      let vehicleText = vehicleParts.length ? vehicleParts.join(" ") : "Not configured";
      if (mileage) vehicleText += ` • ${mileage} miles`;
      if (system) vehicleText += ` • ${system}`;
      preview.vehicle.textContent = vehicleText;
    }

    if (preview.dtcs) {
      const code = value(fields.primaryDtc);
      const description = value(fields.dtcDescription);
      preview.dtcs.textContent = code ? `${code}${description ? ` — ${description}` : ""}` : "None added";
    }

    if (preview.liveData) {
      const liveData = [
        value(fields.rpm) ? `RPM ${value(fields.rpm)}` : "",
        value(fields.voltage) ? `${value(fields.voltage)}V` : "",
        value(fields.coolant) ? `ECT ${value(fields.coolant)}` : "",
        value(fields.fuelTrim) ? `FT ${value(fields.fuelTrim)}` : ""
      ].filter(Boolean);

      preview.liveData.textContent = liveData.length ? liveData.join(" • ") : "Not configured";
    }

    if (preview.ase) {
      const ase = value(fields.aseArea);
      const root = value(fields.rootCause);
      preview.ase.textContent = ase ? `${ase}${root ? ` • Root cause: ${root}` : ""}` : "Not mapped";
    }

    renderChecklist(getValidationItems());
    renderJsonPreview();
  }

  function validateScenario() {
    const items = getValidationItems();
    const ready = items.every(([, valid]) => Boolean(valid));
    setStatus(ready ? "Ready" : "Needs Data");
    renderChecklist(items);
    renderJsonPreview();
    return ready;
  }

  function setField(field, fieldValue) {
    if (field) field.value = fieldValue || "";
  }

  function loadScenario(scenario) {
    if (!scenario || typeof scenario !== "object") return;

    const firstDtc = scenario.evidence && Array.isArray(scenario.evidence.dtcs)
      ? scenario.evidence.dtcs[0] || {}
      : {};

    setField(fields.title, scenario.title);
    setField(fields.year, scenario.vehicle && scenario.vehicle.year);
    setField(fields.make, scenario.vehicle && scenario.vehicle.make);
    setField(fields.model, scenario.vehicle && scenario.vehicle.model);
    setField(fields.engine, scenario.vehicle && scenario.vehicle.engine);
    setField(fields.mileage, scenario.vehicle && scenario.vehicle.mileage);
    setField(fields.system, scenario.vehicle && scenario.vehicle.system);
    setField(fields.complaint, scenario.complaint && scenario.complaint.customer);
    setField(fields.primaryDtc, firstDtc.code);
    setField(fields.dtcDescription, firstDtc.description);
    setField(fields.freezeFrame, scenario.evidence && scenario.evidence.freezeFrame);
    setField(fields.rpm, scenario.evidence && scenario.evidence.liveData && scenario.evidence.liveData.rpm);
    setField(fields.voltage, scenario.evidence && scenario.evidence.liveData && scenario.evidence.liveData.voltage);
    setField(fields.coolant, scenario.evidence && scenario.evidence.liveData && scenario.evidence.liveData.coolant);
    setField(fields.fuelTrim, scenario.evidence && scenario.evidence.liveData && scenario.evidence.liveData.fuelTrim);
    setField(fields.initialTest, scenario.diagnosticPath && scenario.diagnosticPath.initialTest);
    setField(fields.expectedFinding, scenario.diagnosticPath && scenario.diagnosticPath.expectedFinding);
    setField(fields.rootCause, scenario.diagnosticPath && scenario.diagnosticPath.rootCause);
    setField(fields.recommendedRepair, scenario.diagnosticPath && scenario.diagnosticPath.recommendedRepair);
    setField(fields.aseArea, scenario.rubric && scenario.rubric.aseArea);
    setField(fields.safetyCriteria, scenario.rubric && scenario.rubric.safety);
    setField(fields.diagnosticCriteria, scenario.rubric && scenario.rubric.diagnosis);
    setField(fields.verificationCriteria, scenario.rubric && scenario.rubric.verification);

    validateScenario();
    renderPreview();
    setStatus("Imported");
  }

  function importScenarioFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        loadScenario(JSON.parse(String(reader.result || "{}")));
      } catch (error) {
        setStatus("Import Error");
      }
    });
    reader.readAsText(file);
  }
  function exportScenario() {
    const scenario = buildScenario();
    const blob = new Blob([JSON.stringify(scenario, null, 2)], {
      type: "application/json"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${scenario.id || "scenario-draft"}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus("Exported");
  }

  Object.values(fields).forEach((field) => {
    if (field) field.addEventListener("input", renderPreview);
    if (field) field.addEventListener("change", renderPreview);
  });

  if (validateButton) {
    validateButton.addEventListener("click", validateScenario);
  }

  if (saveButton) {
    saveButton.addEventListener("click", () => {
      renderJsonPreview();
      setStatus("Saved");
    });
  }

  if (exportButton) {
    exportButton.addEventListener("click", exportScenario);
  }

  if (importButton && importInput) {
    importButton.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", () => {
      importScenarioFile(importInput.files && importInput.files[0]);
      importInput.value = "";
    });
  }

  window.TorqueMindAuthoring = {
    buildScenario,
    loadScenario,
    validateScenario
  };

  seedDemoData();
  renderPreview();
  document.body.dataset.authoringStudioReady = "true";
})();


