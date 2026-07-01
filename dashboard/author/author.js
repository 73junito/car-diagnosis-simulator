(function () {
  const validateButton = document.getElementById("validateScenarioBtn");
  const saveButton = document.getElementById("saveDraftBtn");
  const validationStatus = document.getElementById("validationStatus");

  function setStatus(message) {
    if (validationStatus) validationStatus.textContent = message;
  }

  if (validateButton) {
    validateButton.addEventListener("click", () => {
      setStatus("Needs Data");
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", () => {
      setStatus("Saved");
    });
  }
})();
