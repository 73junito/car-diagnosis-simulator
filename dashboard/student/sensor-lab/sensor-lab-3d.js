"use strict";

(async function initSensorLab3dClassroom() {
  const canvas = document.getElementById("sensor3dCanvas");
  const status = document.getElementById("sensor3dStatus");
  const assetList = document.getElementById("sensor3dAssetList");
  const title = document.getElementById("sensor3dModelTitle");
  const role = document.getElementById("sensor3dModelRole");
  const testPointSelect = document.getElementById("sensor3dTestPoint");
  const bindingValue = document.getElementById("sensor3dBindingValue");
  const bindingLabel = document.getElementById("sensor3dBindingLabel");
  const faultState = document.getElementById("sensor3dFaultState");
  const probeState = document.getElementById("sensor3dProbeState");
  const faultSelect = document.getElementById("faultSelect");

  if (!canvas || !status || !assetList || !window.AutoLearnProGlbViewer) return;

  const [runtimeResponse, manifestResponse, templateResponse] = await Promise.all([
    fetch("/data/architecture/sensor-lab-lmf-runtime.json"),
    fetch("/data/architecture/sensor-lab-3d-assets.json"),
    fetch("/data/circuit-templates/12v-three-wire-sensor.json")
  ]);
  if (!runtimeResponse.ok || !manifestResponse.ok || !templateResponse.ok) {
    status.textContent = "3D Sensor Lab presentation metadata is unavailable. Sensor engineering behavior is unchanged.";
    status.dataset.state = "unavailable";
    return;
  }

  const runtime = await runtimeResponse.json();
  const manifest = await manifestResponse.json();
  const template = await templateResponse.json();

  if (manifest.authoritativeRuntime !== "/data/architecture/sensor-lab-lmf-runtime.json") {
    throw new Error("Sensor 3D presentation manifest is not bound to the authoritative runtime.");
  }
  if (manifest.authoritativeTemplate !== runtime.modelRef) {
    throw new Error("Sensor 3D presentation manifest is not bound to the runtime model.");
  }
  if (Object.values(manifest.authority || {}).some(Boolean)) {
    throw new Error("Sensor 3D presentation must not claim engineering or governance authority.");
  }

  const declaredTools = new Set(runtime.toolIds || []);
  const assets = (manifest.assets || []).map((asset) => ({
    ...asset,
    enabled: asset.kind !== "diagnostic-tool" || declaredTools.has(asset.toolId)
  }));
  const viewer = new window.AutoLearnProGlbViewer.GlbViewer(canvas, status);
  const inspection = document.getElementById("sensor3dInspectionPresets");
  if (inspection && new URLSearchParams(window.location.search).get("equipmentInspection") === "1") {
    inspection.hidden = false;
    window.AutoLearnProEquipmentInspection?.mount({ viewer, container: inspection, status });
  }
  const assetRoot = manifest.assetRoot || "/dashboard/student/circuit-lab/assets/3d/";
  const testPointById = new Map((template.testPoints || []).map((item) => [item.id, item]));
  const bindingById = new Map((manifest.testPointBindings || []).map((item) => [item.testPointId, item]));

  function describeAsset(asset) {
    if (asset.kind === "diagnostic-tool") {
      return asset.enabled
        ? "Runtime-declared diagnostic tool. The 3D mesh displays existing Sensor Lab state only."
        : "Reusable 3D asset present, but this tool is not enabled by the Sensor Lab runtime.";
    }
    return "Presentation-only scene asset. It does not create measurements, faults, scoring, or diagnostic conclusions.";
  }

  async function selectAsset(asset, button) {
    if (!asset.enabled) return;
    assetList.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    title.textContent = asset.title;
    role.textContent = describeAsset(asset);
    try {
      await viewer.load(assetRoot + asset.file, asset.title);
      if (inspection && !inspection.hidden) window.AutoLearnProEquipmentInspection?.reset(inspection);
    } catch (error) {
      status.textContent = `Unable to render ${asset.title}: ${error.message}. Sensor engineering behavior is unchanged.`;
      status.dataset.state = "unavailable";
    }
  }

  assetList.replaceChildren();
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
    state.textContent = asset.kind === "diagnostic-tool"
      ? (asset.enabled ? "Runtime-enabled tool" : "Not enabled in Sensor Lab")
      : "Presentation-only scene asset";
    button.append(name, state);
    button.addEventListener("click", () => selectAsset(asset, button));
    item.append(button);
    assetList.append(item);
  }

  testPointSelect.replaceChildren();
  for (const binding of manifest.testPointBindings || []) {
    const testPoint = testPointById.get(binding.testPointId);
    if (!testPoint) continue;
    const option = document.createElement("option");
    option.value = binding.testPointId;
    option.textContent = binding.label;
    testPointSelect.append(option);
  }

  function currentBindingValue(binding) {
    if (!binding?.displaySource) return "No numeric value inferred by the Sensor Lab model";
    const source = document.querySelector(binding.displaySource);
    return source?.textContent?.trim() || "Runtime value unavailable";
  }

  function renderBinding() {
    const binding = bindingById.get(testPointSelect.value);
    const testPoint = testPointById.get(testPointSelect.value);
    if (!binding || !testPoint) return;
    bindingLabel.textContent = `${binding.label} · ${(binding.measurementTypes || []).join(", ")}`;
    bindingValue.textContent = currentBindingValue(binding);
    probeState.textContent = `Probe target: ${binding.testPointId} → ${testPoint.terminalId}. Presentation target only; no measurement is generated by the 3D layer.`;
  }

  function renderFault() {
    const selected = faultSelect?.selectedOptions?.[0];
    const faultId = faultSelect?.value || "";
    if (!faultId) {
      faultState.textContent = "No injected fault. 3D wiring remains in the healthy presentation state.";
      faultState.dataset.state = "healthy";
      return;
    }
    const fault = (template.faultCatalog || []).find((item) => item.id === faultId);
    faultState.textContent = fault
      ? `Visual fault state: ${selected?.textContent || fault.label} · target ${fault.targetConnectionId || fault.targetTerminalId || "declared circuit element"}.`
      : "Selected fault is controlled by the Sensor Lab runtime.";
    faultState.dataset.state = "fault";
  }

  const observedNodes = (manifest.testPointBindings || [])
    .map((binding) => binding.displaySource ? document.querySelector(binding.displaySource) : null)
    .filter(Boolean);
  const observer = new MutationObserver(renderBinding);
  observedNodes.forEach((node) => observer.observe(node, { childList: true, subtree: true, characterData: true }));

  testPointSelect.addEventListener("change", renderBinding);
  faultSelect?.addEventListener("change", renderFault);
  document.getElementById("sensorInput")?.addEventListener("input", () => requestAnimationFrame(renderBinding));
  document.getElementById("stateSelect")?.addEventListener("change", () => requestAnimationFrame(renderBinding));

  const initial = assets.find((asset) => asset.toolId === "tool.dmm" && asset.enabled)
    || assets.find((asset) => asset.enabled);
  if (initial) {
    const button = assetList.querySelector(`[data-asset-id="${initial.assetId}"] button`);
    await selectAsset(initial, button);
  }

  renderBinding();
  renderFault();
  document.documentElement.dataset.sensorLab3d = "presentation-only";
})().catch((error) => {
  const status = document.getElementById("sensor3dStatus");
  if (status) {
    status.textContent = `3D Sensor Lab presentation unavailable: ${error.message}`;
    status.dataset.state = "unavailable";
  }
  console.error("Sensor Lab 3D presentation failed:", error);
});
