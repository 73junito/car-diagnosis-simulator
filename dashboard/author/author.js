(function () {
  const validateButton = document.getElementById("validateScenarioBtn");
  const saveButton = document.getElementById("saveDraftBtn");
  const exportButton = document.getElementById("exportDraftBtn");
  const importButton = document.getElementById("importDraftBtn");
  const importInput = document.getElementById("importScenarioInput");
  const templateSelect = document.getElementById("scenarioTemplate");
  const loadTemplateButton = document.getElementById("loadTemplateBtn");
  const validationStatus = document.getElementById("validationStatus");
  const checklist = document.getElementById("validationChecklist");
  const jsonPreview = document.getElementById("scenarioJsonPreview");
  const saveToLibraryButton = document.getElementById("saveToLibraryBtn");
  const librarySearchInput = document.getElementById("librarySearchInput");
  const scenarioLibraryList = document.getElementById("scenarioLibraryList");
  const authorAccessStatus = document.getElementById("authorAccessStatus");
  const requestReviewButton = document.getElementById("requestReviewBtn");
  const draftLifecycleStatus = document.getElementById("draftLifecycleStatus");
  const evidenceSearchInput = document.getElementById("evidenceSearchInput");
  const evidenceSearchButton = document.getElementById("evidenceSearchBtn");
  const evidenceSearchResults = document.getElementById("evidenceSearchResults");
  const linkedEvidenceList = document.getElementById("linkedEvidenceList");
  const evidenceStatus = document.getElementById("evidenceStatus");
  let currentDraft = null;
  let linkedEvidence = [];
  let serverDrafts = [];
  let autosaveTimer = null;

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

  function setLifecycleStatus(message) {
    if (draftLifecycleStatus) draftLifecycleStatus.textContent = message;
  }

  function reviewEditable(draft) {
    return !draft || draft.reviewStatus === "not_requested" || draft.reviewStatus === "changes_requested";
  }

  function applyDraftLifecycle() {
    const editable = reviewEditable(currentDraft);
    Object.values(fields).forEach((field) => {
      if (field) field.disabled = !editable;
    });
    if (saveButton) saveButton.disabled = !editable;
    if (saveToLibraryButton) saveToLibraryButton.disabled = !editable;
    if (requestReviewButton) {
      requestReviewButton.disabled = !currentDraft || !editable;
    }
    if (evidenceSearchButton) evidenceSearchButton.disabled = !currentDraft || !editable;
    if (evidenceSearchInput) evidenceSearchInput.disabled = !currentDraft || !editable;

    if (!currentDraft) {
      setLifecycleStatus("Unsaved draft. Autosave begins after the first explicit save.");
      return;
    }

    const status = currentDraft.reviewStatus || "not_requested";
    if (status === "pending") {
      setLifecycleStatus("Review pending. Editing and autosave are locked until an administrator responds.");
    } else if (status === "changes_requested") {
      setLifecycleStatus("Changes requested" + (currentDraft.reviewNote ? ": " + currentDraft.reviewNote : "") + ". Editing and autosave are enabled.");
    } else if (status === "review_complete") {
      setLifecycleStatus("Review complete. This draft remains private and unpublished.");
    } else {
      setLifecycleStatus("Private draft v" + currentDraft.version + ". Autosave is active after changes.");
    }
  }

  function evidenceLocation(item) {
    const parts = [item.section, item.locator].filter(Boolean);
    if (item.pageStart) parts.push("p. " + item.pageStart + (item.pageEnd && item.pageEnd !== item.pageStart ? "–" + item.pageEnd : ""));
    return parts.join(" · ");
  }

  function renderLinkedEvidence() {
    if (!linkedEvidenceList) return;
    linkedEvidenceList.innerHTML = "";
    if (!linkedEvidence.length) {
      const empty = document.createElement("li");
      empty.textContent = currentDraft ? "No approved evidence linked yet." : "Save a draft before linking evidence.";
      linkedEvidenceList.appendChild(empty);
      return;
    }

    linkedEvidence.forEach((link) => {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = (link.source && link.source.title) || link.sourceId;
      const detail = document.createElement("span");
      const location = evidenceLocation(link.chunk || {});
      detail.textContent = " · " + link.evidenceRole.replaceAll("-", " ") + " · " + link.claimText +
        (location ? " · " + location : "");

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tm-btn tm-btn-secondary";
      remove.textContent = "Unlink";
      remove.disabled = !reviewEditable(currentDraft);
      remove.addEventListener("click", async () => {
        if (!currentDraft) return;
        try {
          await window.apiDelete(
            "/api/author/drafts/" + encodeURIComponent(currentDraft.id) +
            "/evidence/" + encodeURIComponent(link.id)
          );
          await loadLinkedEvidence();
          if (evidenceStatus) evidenceStatus.textContent = "Evidence link removed.";
        } catch (error) {
          if (evidenceStatus) evidenceStatus.textContent = "Unable to remove evidence link.";
        }
      });

      item.append(title, detail, document.createTextNode(" "), remove);
      linkedEvidenceList.appendChild(item);
    });
  }

  async function loadLinkedEvidence() {
    if (!currentDraft) {
      linkedEvidence = [];
      renderLinkedEvidence();
      return;
    }
    const response = await window.apiGet(
      "/api/author/drafts/" + encodeURIComponent(currentDraft.id) + "/evidence"
    );
    linkedEvidence = Array.isArray(response && response.links) ? response.links : [];
    renderLinkedEvidence();
  }

  function renderEvidenceSearchResults(results) {
    if (!evidenceSearchResults) return;
    evidenceSearchResults.innerHTML = "";
    if (!results.length) {
      const empty = document.createElement("li");
      empty.textContent = "No approved evidence matched the search.";
      evidenceSearchResults.appendChild(empty);
      return;
    }

    results.forEach((result) => {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = result.sourceTitle || result.sourceId;
      const detail = document.createElement("span");
      const location = evidenceLocation(result);
      detail.textContent = " · " + result.chunkId + (location ? " · " + location : "");

      const role = document.createElement("select");
      [
        ["supports-scenario", "Supports scenario"],
        ["supports-diagnosis", "Supports diagnosis"],
        ["supports-repair", "Supports repair"],
        ["research-reference", "Research reference"]
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        role.appendChild(option);
      });

      const claim = document.createElement("input");
      claim.type = "text";
      claim.maxLength = 1000;
      claim.placeholder = "Claim or decision this source supports";

      const linkButton = document.createElement("button");
      linkButton.type = "button";
      linkButton.className = "tm-btn tm-btn-primary";
      linkButton.textContent = "Link";
      linkButton.disabled = !currentDraft || !reviewEditable(currentDraft);
      linkButton.addEventListener("click", async () => {
        if (!currentDraft) return;
        const claimText = claim.value.trim();
        if (!claimText) {
          if (evidenceStatus) evidenceStatus.textContent = "Describe the claim this evidence supports.";
          claim.focus();
          return;
        }
        try {
          await window.apiPost(
            "/api/author/drafts/" + encodeURIComponent(currentDraft.id) + "/evidence",
            {
              sourceId: result.sourceId,
              chunkId: result.chunkId,
              evidenceRole: role.value,
              claimText
            }
          );
          claim.value = "";
          await loadLinkedEvidence();
          if (evidenceStatus) evidenceStatus.textContent = "Approved evidence linked to the private draft.";
        } catch (error) {
          if (evidenceStatus) {
            evidenceStatus.textContent = error && error.status === 409
              ? "Evidence link rejected or already exists."
              : "Unable to link approved evidence.";
          }
        }
      });

      item.append(title, detail, document.createElement("br"), role, document.createTextNode(" "), claim, document.createTextNode(" "), linkButton);
      evidenceSearchResults.appendChild(item);
    });
  }

  async function searchApprovedEvidence() {
    if (!currentDraft) {
      if (evidenceStatus) evidenceStatus.textContent = "Save the draft before linking evidence.";
      return;
    }
    const query = evidenceSearchInput ? evidenceSearchInput.value.trim() : "";
    try {
      if (evidenceStatus) evidenceStatus.textContent = "Searching approved evidence…";
      const response = await window.apiGet("/api/author/evidence-sources?query=" + encodeURIComponent(query));
      const results = Array.isArray(response && response.results) ? response.results : [];
      renderEvidenceSearchResults(results);
      if (evidenceStatus) evidenceStatus.textContent = results.length + " approved evidence result" + (results.length === 1 ? "" : "s") + ".";
    } catch (error) {
      if (evidenceStatus) evidenceStatus.textContent = "Approved evidence search unavailable.";
    }
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
    setStatus(ready ? "Draft Valid" : "Draft Needs Data");
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

  function loadSelectedTemplate() {
    if (!templateSelect || !window.AuthoringTemplates) return;

    const template = window.AuthoringTemplates[templateSelect.value];
    if (!template) return;

    Object.entries(template).forEach(([key, templateValue]) => {
      if (fields[key]) fields[key].value = templateValue || "";
    });

    validateScenario();
    renderPreview();
    setStatus("Template Loaded");
  }

  function scenarioSearchText(draft) {
    return [
      draft.title,
      draft.scenarioKey
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function renderLibrary() {
    if (!scenarioLibraryList) return;

    const query = librarySearchInput ? librarySearchInput.value.trim().toLowerCase() : "";
    const filtered = query
      ? serverDrafts.filter((draft) => scenarioSearchText(draft).includes(query))
      : serverDrafts;

    scenarioLibraryList.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("li");
      empty.textContent = serverDrafts.length ? "No matching drafts." : "No saved drafts yet.";
      scenarioLibraryList.appendChild(empty);
      return;
    }

    filtered.forEach((draft) => {
      const item = document.createElement("li");
      item.dataset.draftId = draft.id;

      const title = document.createElement("strong");
      title.textContent = draft.title || "Untitled Scenario";

      const version = document.createElement("span");
      version.textContent = " v" + String(draft.version || 1) + " · " + String(draft.reviewStatus || "not_requested").replaceAll("_", " ");

      const load = document.createElement("button");
      load.type = "button";
      load.className = "tm-btn tm-btn-secondary";
      load.textContent = "Load";
      load.addEventListener("click", async () => {
        try {
          const response = await window.apiGet("/api/author/drafts/" + encodeURIComponent(draft.id));
          currentDraft = response.draft;
          loadScenario(currentDraft.scenario);
          applyDraftLifecycle();
          await loadLinkedEvidence();
          setStatus("Draft Loaded · v" + currentDraft.version);
        } catch (error) {
          setStatus(error && error.status === 404 ? "Draft Not Found" : "Load Failed");
        }
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tm-btn tm-btn-secondary";
      remove.textContent = "Delete";
      remove.disabled = draft.reviewStatus !== "not_requested";
      remove.addEventListener("click", async () => {
        try {
          await window.apiDelete("/api/author/drafts/" + encodeURIComponent(draft.id));
          if (currentDraft && currentDraft.id === draft.id) currentDraft = null;
          await loadDraftLibrary();
          setStatus("Draft Deleted");
        } catch (error) {
          setStatus("Delete Failed");
        }
      });

      item.appendChild(title);
      item.appendChild(version);
      item.appendChild(document.createTextNode(" "));
      item.appendChild(load);
      item.appendChild(document.createTextNode(" "));
      item.appendChild(remove);

      scenarioLibraryList.appendChild(item);
    });
  }

  async function loadDraftLibrary() {
    const response = await window.apiGet("/api/author/drafts?limit=100");
    serverDrafts = Array.isArray(response && response.drafts) ? response.drafts : [];
    renderLibrary();
  }

  function syncDraftSummary(draft) {
    if (!draft) return;
    serverDrafts = [draft, ...serverDrafts.filter((item) => item.id !== draft.id)];
    renderLibrary();
  }

  async function saveDraft(options = {}) {
    const autosave = Boolean(options.autosave);
    if (currentDraft && !reviewEditable(currentDraft)) {
      setLifecycleStatus("This draft is locked while review is pending or complete.");
      return false;
    }

    const scenario = buildScenario();
    try {
      if (autosave) setLifecycleStatus("Autosaving private draft…");
      const response = currentDraft
        ? await window.apiPatch("/api/author/drafts/" + encodeURIComponent(currentDraft.id), {
            version: currentDraft.version,
            scenario
          })
        : await window.apiPost("/api/author/drafts", { scenario });

      currentDraft = response.draft;
      syncDraftSummary(currentDraft);
      applyDraftLifecycle();
      if (!autosave) await loadLinkedEvidence();
      setStatus((autosave ? "Autosaved" : "Saved Draft") + " · v" + currentDraft.version);
      return true;
    } catch (error) {
      if (error && error.status === 409) {
        setStatus("Draft Changed · Reload Required");
        setLifecycleStatus("Autosave stopped because the server draft changed. Reload before editing.");
        return false;
      }
      setStatus(autosave ? "Autosave Failed" : "Save Failed");
      return false;
    }
  }

  function scheduleAutosave() {
    if (!currentDraft || !reviewEditable(currentDraft)) return;
    if (autosaveTimer) window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = null;
      saveDraft({ autosave: true });
    }, 1500);
  }

  async function requestReview() {
    if (!validateScenario()) {
      setLifecycleStatus("Complete the validation checklist before requesting review.");
      return;
    }

    if (autosaveTimer) {
      window.clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }

    const saved = await saveDraft();
    if (!saved || !currentDraft) return;

    try {
      const response = await window.apiPost(
        "/api/author/drafts/" + encodeURIComponent(currentDraft.id) + "/review-request",
        { version: currentDraft.version }
      );
      currentDraft = response.draft;
      syncDraftSummary(currentDraft);
      applyDraftLifecycle();
      setStatus("Review Requested");
    } catch (error) {
      if (error && error.status === 409) {
        setStatus("Review Request Conflict");
        setLifecycleStatus("Reload the server draft before requesting review.");
        return;
      }
      setStatus("Review Request Failed");
    }
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
    if (field) field.addEventListener("input", () => {
      renderPreview();
      scheduleAutosave();
    });
    if (field) field.addEventListener("change", () => {
      renderPreview();
      scheduleAutosave();
    });
  });

  if (validateButton) {
    validateButton.addEventListener("click", validateScenario);
  }

  if (saveToLibraryButton) {
    saveToLibraryButton.addEventListener("click", saveDraft);
  }

  if (librarySearchInput) {
    librarySearchInput.addEventListener("input", renderLibrary);
  }

  if (saveButton) {
    saveButton.addEventListener("click", () => saveDraft());
  }

  if (requestReviewButton) {
    requestReviewButton.addEventListener("click", requestReview);
  }

  if (evidenceSearchButton) {
    evidenceSearchButton.addEventListener("click", searchApprovedEvidence);
  }
  if (evidenceSearchInput) {
    evidenceSearchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchApprovedEvidence();
      }
    });
  }

  if (exportButton) {
    exportButton.addEventListener("click", exportScenario);
  }

  if (loadTemplateButton) {
    loadTemplateButton.addEventListener("click", loadSelectedTemplate);
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
    validateScenario,
    loadSelectedTemplate
  };

  async function initializeAuthoring() {
    const token = window.getAccessToken ? window.getAccessToken() : null;
    if (!token) {
      window.location.replace("/sign-in/instructor/");
      return;
    }

    try {
      await loadDraftLibrary();
      if (authorAccessStatus) authorAccessStatus.textContent = "Verified author · private drafts";
      renderPreview();
      applyDraftLifecycle();
      renderLinkedEvidence();
      document.body.dataset.authoringStudioReady = "true";
    } catch (error) {
      if (error && (error.status === 401 || error.status === 403)) {
        window.location.replace("/sign-in/instructor/");
        return;
      }
      if (authorAccessStatus) authorAccessStatus.textContent = "Authoring unavailable";
      setStatus("Unavailable");
    }
  }

  initializeAuthoring();
})();





