(function () {
  "use strict";

  const AUTHORITY_FLAGS = Object.freeze([
    "engineeringAuthority",
    "measurementAuthority",
    "assessmentAuthority",
    "publicationAuthority",
    "controlsEngineeringState"
  ]);

  function assertGovernance(manifest, where = "circuit-lab-scene") {
    const errors = [];
    if (!manifest || typeof manifest !== "object") return [where + ": manifest must be an object"];
    const authority = manifest.authority || {};
    for (const flag of AUTHORITY_FLAGS) {
      if (authority[flag] !== false) errors.push(where + ": authority." + flag + " must be false");
    }
    return errors;
  }

  function CircuitLabScene() {
    this.runtime = null;
    this.manifest = null;
    this.template = null;
    this.assets = new Map();
    this.testPoints = new Map();
  }

  CircuitLabScene.prototype.loadContracts = function ({ runtime, manifest, template }) {
    const errors = assertGovernance(manifest);
    if (errors.length) throw new Error(errors.join("; "));
    if (manifest.authoritativeRuntime !== "/data/architecture/circuit-lab-lmf-runtime.json") {
      throw new Error("3D manifest is not bound to the Circuit Lab runtime.");
    }
    if (manifest.authoritativeTemplate !== runtime.modelRef) {
      throw new Error("3D manifest is not bound to the Circuit Lab model.");
    }

    this.runtime = runtime;
    this.manifest = manifest;
    this.template = template;
    this.assets.clear();
    this.testPoints.clear();

    const declaredTools = new Set(runtime.toolIds || []);
    for (const asset of manifest.assets || []) {
      const url = asset.url || ((manifest.assetRoot || "") + asset.file);
      if (!asset.assetId || !url) continue;
      this.assets.set(asset.assetId, {
        ...asset,
        id: asset.assetId,
        url,
        enabled: asset.kind !== "diagnostic-tool" || declaredTools.has(asset.toolId)
      });
    }

    const modelPoints = new Map((template.testPoints || []).map((point) => [point.id, point]));
    const componentIds = new Set((template.components || []).map((component) => component.id));
    for (const binding of manifest.testPointBindings || []) {
      const point = modelPoints.get(binding.testPointId);
      if (!point) throw new Error("3D manifest references unknown Circuit Lab test point " + binding.testPointId);
      if (binding.componentId && !componentIds.has(binding.componentId)) {
        throw new Error("3D manifest references unknown Circuit Lab component " + binding.componentId);
      }
      this.testPoints.set(binding.testPointId, {
        ...binding,
        id: binding.testPointId,
        terminalId: point.terminalId,
        measurementTypes: [...(point.measurementTypes || [])],
        vehicleSpecificValueRequired: !!point.vehicleSpecificValueRequired
      });
    }

    const expected = [...modelPoints.keys()];
    if (expected.length !== this.testPoints.size || expected.some((id) => !this.testPoints.has(id))) {
      throw new Error("Circuit Lab 3D test-point bindings must exactly cover the authoritative model.");
    }

    return this.getSceneSummary();
  };

  CircuitLabScene.prototype.getAssets = function () {
    return Array.from(this.assets.values());
  };

  CircuitLabScene.prototype.getTestPoints = function () {
    return Array.from(this.testPoints.values());
  };

  CircuitLabScene.prototype.getTestPoint = function (id) {
    return this.testPoints.get(id) || null;
  };

  CircuitLabScene.prototype.isToolEnabled = function (toolId) {
    return this.getAssets().some((asset) =>
      asset.kind === "diagnostic-tool" && asset.toolId === toolId && asset.enabled
    );
  };

  CircuitLabScene.prototype.getSceneSummary = function () {
    return {
      assetCount: this.assets.size,
      enabledToolAssetCount: this.getAssets().filter((asset) => asset.kind === "diagnostic-tool" && asset.enabled).length,
      testPointCount: this.testPoints.size
    };
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { CircuitLabScene, assertGovernance, AUTHORITY_FLAGS };
  }
  if (typeof window !== "undefined") {
    window.AutoLearnProPresentation = window.AutoLearnProPresentation || {};
    window.AutoLearnProPresentation.CircuitLabScene = CircuitLabScene;
  }
})();