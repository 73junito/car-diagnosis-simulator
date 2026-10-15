"use strict";

(async function initCircuitLab3dEquipment() {
  const list = document.getElementById("lab3dAssetList");
  const canvas = document.getElementById("lab3dCanvas");
  const status = document.getElementById("lab3dStatus");
  const title = document.getElementById("lab3dModelTitle");
  const role = document.getElementById("lab3dModelRole");
  if (!list || !canvas || !status || !window.AutoLearnProGlbViewer) return;

  const [runtimeResponse, manifestResponse] = await Promise.all([
    fetch("/data/architecture/circuit-lab-lmf-runtime.json"),
    fetch("/data/architecture/circuit-lab-3d-assets.json")
  ]);
  if (!runtimeResponse.ok || !manifestResponse.ok) {
    status.textContent = "3D equipment metadata is unavailable. Circuit Lab engineering behavior is unchanged.";
    status.dataset.state = "unavailable";
    return;
  }

  const runtime = await runtimeResponse.json();
  const manifest = await manifestResponse.json();
  if (manifest.authoritativeRuntime !== "/data/architecture/circuit-lab-lmf-runtime.json") {
    throw new Error("Circuit Lab 3D asset manifest is not bound to the authoritative runtime.");
  }
  if (Object.values(manifest.authority || {}).some(Boolean)) {
    throw new Error("Circuit Lab 3D presentation manifest must not claim engineering or governance authority.");
  }

  const declaredTools = new Set(runtime.toolIds || []);
  const assets = (manifest.assets || []).map((asset) => ({
    ...asset,
    enabled: asset.kind !== "diagnostic-tool" || declaredTools.has(asset.toolId)
  }));

  const viewer = new window.AutoLearnProGlbViewer.GlbViewer(canvas, status);
  const assetRoot = manifest.assetRoot || "/dashboard/student/circuit-lab/assets/3d/";

  function describeRole(asset) {
    if (asset.kind === "diagnostic-tool") {
      return asset.enabled
        ? "Diagnostic tool declared by the Circuit Lab runtime. The 3D model is presentation only."
        : "3D asset available, but this diagnostic tool is not enabled by the Circuit Lab runtime.";
    }
    return "Visual scene asset only. It does not create measurements, faults, or engineering state.";
  }

  async function selectAsset(asset, button) {
    if (!asset.enabled) return;
    list.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    title.textContent = asset.title;
    role.textContent = describeRole(asset);
    try {
      await viewer.load(assetRoot + asset.file, asset.title);
    } catch (error) {
      status.textContent = `Unable to render ${asset.title}: ${error.message}. Circuit Lab engineering behavior is unchanged.`;
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
    } else {
      state.textContent = "Presentation-only scene asset";
    }
    button.append(name, state);
    button.addEventListener("click", () => selectAsset(asset, button));
    item.append(button);
    list.append(item);
  }

  const initial = assets.find((asset) => asset.kind === "diagnostic-tool" && asset.enabled) || assets.find((asset) => asset.enabled);
  if (initial) {
    const button = list.querySelector(`[data-asset-id="${initial.assetId}"] button`);
    await selectAsset(initial, button);
  } else {
    status.textContent = "No 3D equipment is enabled by the current runtime.";
    status.dataset.state = "unavailable";
  }

  document.documentElement.setAttribute("data-circuit-lab-3d", "presentation-only");
})().catch((error) => {
  const status = document.getElementById("lab3dStatus");
  if (status) {
    status.textContent = `3D equipment presentation unavailable: ${error.message}`;
    status.dataset.state = "unavailable";
  }
  console.error("Circuit Lab 3D presentation failed:", error);
});
