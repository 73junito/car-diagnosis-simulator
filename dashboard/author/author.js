(function () {
  const validateButton = document.getElementById("validateScenarioBtn");
  const saveButton = document.getElementById("saveDraftBtn");
  const validationStatus = document.getElementById("validationStatus");

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
  }

  function setStatus(message) {
    if (validationStatus) validationStatus.textContent = message;
  }

  Object.values(fields).forEach((field) => {
    if (field) field.addEventListener("input", renderPreview);
    if (field) field.addEventListener("change", renderPreview);
  });

  if (validateButton) {
    validateButton.addEventListener("click", () => {
      const hasVehicle = value(fields.year) && value(fields.make) && value(fields.model);
      const hasComplaint = value(fields.title) && value(fields.complaint);
      const hasEvidence = value(fields.primaryDtc) || value(fields.rpm) || value(fields.voltage);
      const hasPath = value(fields.initialTest) && value(fields.rootCause) && value(fields.recommendedRepair);
      const hasRubric = value(fields.aseArea) && value(fields.diagnosticCriteria);
      setStatus(hasVehicle && hasComplaint && hasEvidence && hasPath && hasRubric ? "Ready" : "Needs Data");
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", () => {
      setStatus("Saved");
    });
  }

  renderPreview();
})();
