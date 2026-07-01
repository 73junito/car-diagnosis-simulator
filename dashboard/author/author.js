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
    system: document.getElementById("vehicleSystem")
  };

  const preview = {
    title: document.getElementById("previewTitle"),
    complaint: document.getElementById("previewComplaint"),
    vehicle: document.getElementById("previewVehicle")
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
      setStatus(hasVehicle && hasComplaint ? "Ready" : "Needs Data");
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", () => {
      setStatus("Saved");
    });
  }

  renderPreview();
})();
