(function () {
  "use strict";

  const AUTHORITY_FLAGS = Object.freeze([
    "engineeringAuthority",
    "measurementAuthority",
    "assessmentAuthority",
    "publicationAuthority",
    "controlsEngineeringState"
  ]);

  function assertGovernance(manifest, where = "actuator-lab-scene") {
    const errors = [];
    if (!manifest || typeof manifest !== "object") return [where + ": manifest must be an object"];
    const authority = manifest.authority || {};
    for (const flag of AUTHORITY_FLAGS) {
      if (authority[flag] !== false) errors.push(where + ": authority." + flag + " must be false");
    }
    return errors;
  }

  function ActuatorLabScene() {
    this.runtime = null;
    this.manifest = null;
    this.template = null;
    this.profile = null;
    this.assets = new Map();
    this.testPoints = new Map();
    this.probes = new Map([
      ["probe.red", { id: "probe.red", label: "Red probe", dockedTestPointId: null }],
      ["probe.black", { id: "probe.black", label: "Black probe", dockedTestPointId: null }]
    ]);
    this.activeFault = null;
  }

  ActuatorLabScene.prototype.loadContracts = function ({ runtime, manifest, template, profile }) {
    const errors = assertGovernance(manifest);
    if (errors.length) throw new Error(errors.join("; "));
    if (manifest.authoritativeRuntime !== "/data/architecture/actuator-lab-lmf-runtime.json") {
      throw new Error("3D manifest is not bound to the Actuator Lab runtime.");
    }
    if (manifest.authoritativeTemplate !== runtime.modelRef) {
      throw new Error("3D manifest is not bound to the runtime model.");
    }
    if (manifest.engineeringProfile !== runtime.engineeringProfileRef) {
      throw new Error("3D manifest is not bound to the runtime engineering profile.");
    }

    this.runtime = runtime;
    this.manifest = manifest;
    this.template = template;
    this.profile = profile;
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
        vehicleSpecificValueRequired: !!point.vehicleSpecificValueRequired
      });
    }

    return this.getSceneSummary();
  };

  ActuatorLabScene.prototype.getSceneSummary = function () {
    const toolAssets = this.getAssets().filter((asset) => asset.kind === "diagnostic-tool");
    return {
      assetCount: this.assets.size,
      enabledToolAssetCount: toolAssets.filter((asset) => asset.enabled).length,
      testPointCount: this.testPoints.size,
      probeCount: this.probes.size,
      activeFault: this.activeFault
    };
  };

  ActuatorLabScene.prototype.getAssets = function () {
    return Array.from(this.assets.values());
  };

  ActuatorLabScene.prototype.getTestPoints = function () {
    return Array.from(this.testPoints.values());
  };

  ActuatorLabScene.prototype.getTestPoint = function (id) {
    return this.testPoints.get(id) || null;
  };

  ActuatorLabScene.prototype.isToolDeclared = function (toolId) {
    return (this.runtime?.toolIds || []).includes(toolId);
  };

  ActuatorLabScene.prototype.isToolEnabled = function (toolId) {
    return this.getAssets().some((asset) =>
      asset.kind === "diagnostic-tool" && asset.toolId === toolId && asset.enabled
    );
  };

  ActuatorLabScene.prototype.getProbe = function (id) {
    return this.probes.get(id) || null;
  };

  ActuatorLabScene.prototype.getProbes = function () {
    return Array.from(this.probes.values());
  };

  ActuatorLabScene.prototype.dockProbe = function (probeId, testPointId) {
    const probe = this.probes.get(probeId);
    if (!probe || !this.testPoints.has(testPointId)) return false;
    probe.dockedTestPointId = testPointId;
    return true;
  };

  ActuatorLabScene.prototype.undockProbe = function (probeId) {
    const probe = this.probes.get(probeId);
    if (!probe) return false;
    probe.dockedTestPointId = null;
    return true;
  };

  ActuatorLabScene.prototype.setActiveFault = function (faultId) {
    if (faultId && !(this.template?.faultCatalog || []).some((fault) => fault.id === faultId)) return false;
    this.activeFault = faultId || null;
    return true;
  };

  ActuatorLabScene.prototype.getActiveFault = function () {
    return this.activeFault;
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ActuatorLabScene, assertGovernance, AUTHORITY_FLAGS };
  }
  if (typeof window !== "undefined") {
    window.AutoLearnProPresentation = window.AutoLearnProPresentation || {};
    window.AutoLearnProPresentation.ActuatorLabScene = ActuatorLabScene;
  }
})();