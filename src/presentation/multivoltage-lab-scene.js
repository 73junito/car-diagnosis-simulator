(function () {
  "use strict";

  const AUTHORITY_FLAGS = Object.freeze([
    "engineeringAuthority",
    "measurementAuthority",
    "assessmentAuthority",
    "publicationAuthority",
    "controlsEngineeringState"
  ]);

  function assertGovernance(manifest, where = "multivoltage-lab-scene") {
    const errors = [];
    if (!manifest || typeof manifest !== "object") return [where + ": manifest must be an object"];
    const authority = manifest.authority || {};
    for (const flag of AUTHORITY_FLAGS) {
      if (authority[flag] !== false) errors.push(where + ": authority." + flag + " must be false");
    }
    return errors;
  }

  function MultiVoltageLabScene() {
    this.runtime = null;
    this.manifest = null;
    this.template = null;
    this.assets = new Map();
    this.testPoints = new Map();
    this.activeFault = null;
  }

  MultiVoltageLabScene.prototype.loadContracts = function ({ runtime, manifest, template }) {
    const errors = assertGovernance(manifest);
    if (errors.length) throw new Error(errors.join("; "));
    if (manifest.authoritativeRuntime !== "/data/architecture/multivoltage-lab-lmf-runtime.json") {
      throw new Error("3D manifest is not bound to the Multivoltage runtime.");
    }
    if (manifest.authoritativeTemplate !== runtime.modelRef) {
      throw new Error("3D manifest is not bound to the runtime model.");
    }

    this.runtime = runtime;
    this.manifest = manifest;
    this.template = template;
    this.assets.clear();
    this.testPoints.clear();

    const declaredTools = new Set(runtime.toolIds || []);
    for (const asset of manifest.assets || []) {
      if (!asset.assetId || !asset.url) continue;
      this.assets.set(asset.assetId, {
        ...asset,
        id: asset.assetId,
        enabled: asset.kind !== "diagnostic-tool" || declaredTools.has(asset.toolId)
      });
    }

    const modelPoints = new Map((template.testPoints || []).map((point) => [point.id, point]));
    for (const binding of manifest.testPointBindings || []) {
      const point = modelPoints.get(binding.testPointId);
      if (!point) throw new Error("3D manifest references unknown test point " + binding.testPointId);
      this.testPoints.set(binding.testPointId, {
        ...binding,
        id: binding.testPointId,
        terminalId: point.terminalId,
        vehicleSpecificValueRequired: !!point.vehicleSpecificValueRequired,
        trainingSafetyBoundary: binding.trainingSafetyBoundary || point.trainingSafetyBoundary || null
      });
    }

    return this.getSceneSummary();
  };

  MultiVoltageLabScene.prototype.getSceneSummary = function () {
    const toolAssets = this.getAssets().filter((asset) => asset.kind === "diagnostic-tool");
    return {
      assetCount: this.assets.size,
      enabledToolAssetCount: toolAssets.filter((asset) => asset.enabled).length,
      testPointCount: this.testPoints.size,
      activeFault: this.activeFault
    };
  };

  MultiVoltageLabScene.prototype.getAssets = function () {
    return Array.from(this.assets.values());
  };

  MultiVoltageLabScene.prototype.getTestPoints = function () {
    return Array.from(this.testPoints.values());
  };

  MultiVoltageLabScene.prototype.getTestPoint = function (id) {
    return this.testPoints.get(id) || null;
  };

  MultiVoltageLabScene.prototype.isToolEnabled = function (toolId) {
    return this.getAssets().some((asset) =>
      asset.kind === "diagnostic-tool" && asset.toolId === toolId && asset.enabled
    );
  };

  MultiVoltageLabScene.prototype.setActiveFault = function (faultId) {
    if (faultId && !(this.template?.faultCatalog || []).some((fault) => fault.id === faultId)) return false;
    this.activeFault = faultId || null;
    return true;
  };

  MultiVoltageLabScene.prototype.getActiveFault = function () {
    return this.activeFault;
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { MultiVoltageLabScene, assertGovernance, AUTHORITY_FLAGS };
  }
  if (typeof window !== "undefined") {
    window.AutoLearnProPresentation = window.AutoLearnProPresentation || {};
    window.AutoLearnProPresentation.MultiVoltageLabScene = MultiVoltageLabScene;
  }
})();