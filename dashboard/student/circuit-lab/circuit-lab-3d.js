"use strict";

(async function initCircuitLab3dEquipment() {
  const list = document.getElementById("lab3dAssetList");
  const canvas = document.getElementById("lab3dCanvas");
  const status = document.getElementById("lab3dStatus");
  const title = document.getElementById("lab3dModelTitle");
  const role = document.getElementById("lab3dModelRole");
  const testPointList = document.getElementById("lab3dTestPointList");
  const testPointStatus = document.getElementById("lab3dTestPointStatus");
  const Scene = window.AutoLearnProPresentation?.CircuitLabScene;
  if (!list || !canvas || !status || !Scene || !window.AutoLearnProGlbViewer) return;

  const [runtimeResponse, manifestResponse, templateResponse] = await Promise.all([
    fetch("/data/architecture/circuit-lab-lmf-runtime.json"),
    fetch("/data/architecture/circuit-lab-3d-assets.json"),
    fetch("/data/circuits/generic-charging-system.json")
  ]);
  if (!runtimeResponse.ok || !manifestResponse.ok || !templateResponse.ok) {
    status.textContent = "3D equipment metadata is unavailable. Circuit Lab engineering behavior is unchanged.";
    status.dataset.state = "unavailable";
    return;
  }

  const runtime = await runtimeResponse.json();
  const manifest = await manifestResponse.json();
  const template = await templateResponse.json();
  const scene = new Scene();
  const summary = scene.loadContracts({ runtime, manifest, template });
  const assets = scene.getAssets();
  const viewer = new window.AutoLearnProGlbViewer.GlbViewer(canvas, status);
  const inspection = document.getElementById("lab3dInspectionPresets");
  // Explicit opt-in only. No default production behavior changes.
  if (inspection && new URLSearchParams(window.location.search).get("equipmentInspection") === "1") {
    inspection.hidden = false;
    window.AutoLearnProEquipmentInspection?.mount({ viewer, container: inspection, status });
  }

  function describeRole(asset) {
    if (asset.kind === "diagnostic-tool") {
      return asset.enabled
        ? "Diagnostic tool declared by the Circuit Lab runtime. The 3D model is presentation only."
        : "3D asset available, but this diagnostic tool is not enabled by the Circuit Lab runtime.";
    }
    if (asset.kind === "component") {
      return "Generic project-authored charging-system component geometry. It does not simulate electrical output, regulation, current, heat, speed, or vehicle-specific behavior.";
    }
    return "Visual scene asset only. It does not create measurements, faults, or engineering state.";
  }

  function renderTestPoints() {
    if (!testPointList) return;
    testPointList.replaceChildren();
    for (const point of scene.getTestPoints()) {
      const item = document.createElement("li");
      item.dataset.testPointId = point.id;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "lab-3d-asset__button";
      button.setAttribute("aria-pressed", "false");

      const name = document.createElement("strong");
      name.textContent = point.label;
      const detail = document.createElement("span");
      detail.className = "lab-3d-asset__state";
      detail.textContent = point.id + " · " + point.measurementTypes.join(" / ") + " · vehicle-specific value required";

      button.append(name, detail);
      button.addEventListener("click", () => {
        testPointList.querySelectorAll("button").forEach((entry) => entry.setAttribute("aria-pressed", String(entry === button)));
        if (testPointStatus) {
          testPointStatus.textContent =
            point.label + " maps to terminal " + point.terminalId +
            ". The 3D layer does not infer a numeric value; authoritative vehicle-specific service information is required.";
        }
      });

      item.append(button);
      testPointList.append(item);
    }
    if (testPointStatus) {
      testPointStatus.textContent = summary.testPointCount + " authoritative Circuit Lab test points are bound to the 3D presentation.";
    }
  }

  async function selectAsset(asset, button) {
    if (!asset.enabled) return;
    list.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    title.textContent = asset.title;
    role.textContent = describeRole(asset);
    try {
      const review = new URLSearchParams(window.location.search).get("visualReview") === "1";
      const assetUrl = review && asset.assetId === "equipment.dmm"
        ? "/dashboard/student/circuit-lab/assets/3d/multimeter-detailed-review.glb"
        : asset.url;
      viewer.detailedLighting = review && asset.assetId === "equipment.dmm";
      await viewer.load(assetUrl, asset.title);
    } catch (error) {
      status.textContent = "Unable to render " + asset.title + ": " + error.message + ". Circuit Lab engineering behavior is unchanged.";
      status.dataset.state = "unavailable";
    }
  }

  list.replaceChildren();
  for (const asset of assets) {
    const item = document.createElement("li");
    item.className = "lab-3d-asset";
    item.dataset.assetId = asset.assetId;
    item.dataset.assetKind = asset.kind;
    item.dataset.enabled = String(asset.enabled);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "lab-3d-asset__button";
    button.disabled = !asset.enabled;
    button.setAttribute("aria-pressed", "false");

    const name = document.createElement("strong");
    name.textContent = asset.title;
    const state = document.createElement("span");
    state.className = "lab-3d-asset__state";
    if (asset.kind === "diagnostic-tool") {
      state.textContent = asset.enabled ? "Runtime-enabled tool" : "Not enabled in this lab";
    } else if (asset.kind === "component") {
      state.textContent = "Generic charging-system component";
    } else {
      state.textContent = "Presentation-only scene asset";
    }
    button.append(name, state);
    button.addEventListener("click", () => selectAsset(asset, button));
    item.append(button);
    list.append(item);
  }

  renderTestPoints();

  const initial = assets.find((asset) => asset.kind === "diagnostic-tool" && asset.enabled)
    || assets.find((asset) => asset.kind === "component" && asset.id === "component.alternator")
    || assets.find((asset) => asset.enabled);
  if (initial) {
    const button = list.querySelector('[data-asset-id="' + initial.assetId + '"] button');
    await selectAsset(initial, button);
  } else {
    status.textContent = "No 3D equipment is enabled by the current runtime.";
    status.dataset.state = "unavailable";
  }

  document.documentElement.setAttribute("data-circuit-lab-3d", "presentation-only");
})().catch((error) => {
  const status = document.getElementById("lab3dStatus");
  if (status) {
    status.textContent = "3D equipment presentation unavailable: " + error.message;
    status.dataset.state = "unavailable";
  }
  console.error("Circuit Lab 3D presentation failed:", error);
});