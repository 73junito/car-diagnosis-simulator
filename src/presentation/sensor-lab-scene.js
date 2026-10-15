(function () {
  "use strict";

  const AUTHORITY_FLAGS = Object.freeze([
    "engineeringAuthority",
    "measurementAuthority",
    "assessmentAuthority",
    "publicationAuthority",
    "controlsEngineeringState"
  ]);

  function assertGovernance(manifest, where = "sensor-lab-scene") {
    const errors = [];
    if (!manifest || typeof manifest !== "object") {
      return [where + ": manifest must be an object"];
    }
    const authority = manifest.authority || {};
    for (const flag of AUTHORITY_FLAGS) {
      if (authority[flag] !== false) {
        errors.push(where + ": authority." + flag + " must be false");
      }
    }
    return errors;
  }

  function detectWebGL() {
    if (typeof document === "undefined") return false;
    try {
      const canvas = document.createElement("canvas");
      return !!(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    } catch (_) {
      return false;
    }
  }

  function SensorLabScene() {
    this.runtime = null;
    this.manifest = null;
    this.template = null;
    this.profile = null;
    this.webglSupported = detectWebGL();
    this.assets = new Map();
    this.testPoints = new Map();
    this.probes = new Map([
      ["probe.red", { id: "probe.red", label: "Red probe", dockedTestPointId: null }],
      ["probe.black", { id: "probe.black", label: "Black probe", dockedTestPointId: null }]
    ]);
    this.activeFault = null;
  }

  SensorLabScene.prototype.loadContracts = function ({ runtime, manifest, template, profile }) {
    const errors = assertGovernance(manifest);
    if (errors.length) throw new Error(errors.join("; "));
    if (manifest.authoritativeRuntime !== "/data/architecture/sensor-lab-lmf-runtime.json") {
      throw new Error("3D manifest is not bound to the Sensor Lab runtime.");
    }
    if (manifest.authoritativeTemplate !== runtime.modelRef) {
      throw new Error("3D manifest is not bound to the runtime model.");
    }

    this.runtime = runtime;
    this.manifest = manifest;
    this.template = template;
    this.profile = profile;
    this.assets.clear();
    this.testPoints.clear();

    const declaredTools = new Set(runtime.toolIds || []);
    for (const asset of manifest.assets || []) {
      const id = asset.assetId;
      if (!id) continue;
      this.assets.set(id, {
        ...asset,
        id,
        enabled: asset.kind !== "diagnostic-tool" || declaredTools.has(asset.toolId),
        transform: {
          position: [...(asset.transform?.position || [0, 0, 0])],
          rotation: [...(asset.transform?.rotation || [0, 0, 0])],
          scale: [...(asset.transform?.scale || [1, 1, 1])],
          visible: asset.transform?.visible !== false
        }
      });
    }

    const points = new Map((template.testPoints || []).map((item) => [item.id, item]));
    for (const binding of manifest.testPointBindings || []) {
      const point = points.get(binding.testPointId);
      if (!point) throw new Error("3D manifest references unknown test point " + binding.testPointId);
      this.testPoints.set(binding.testPointId, {
        id: binding.testPointId,
        terminalId: point.terminalId,
        label: binding.label || binding.testPointId,
        measurementTypes: binding.measurementTypes || [],
        displaySource: binding.displaySource || null,
        vehicleSpecificValueRequired: !!point.vehicleSpecificValueRequired
      });
    }
    return this.getSceneSummary();
  };

  SensorLabScene.prototype.getSceneSummary = function () {
    const toolAssets = Array.from(this.assets.values()).filter((asset) => asset.kind === "diagnostic-tool");
    return {
      webglSupported: this.webglSupported,
      assetCount: this.assets.size,
      enabledToolCount: toolAssets.filter((asset) => asset.enabled).length,
      testPointCount: this.testPoints.size,
      probeCount: this.probes.size,
      activeFault: this.activeFault
    };
  };

  SensorLabScene.prototype.getAssets = function () {
    return Array.from(this.assets.values());
  };

  SensorLabScene.prototype.getTestPoints = function () {
    return Array.from(this.testPoints.values());
  };

  SensorLabScene.prototype.getTestPoint = function (id) {
    return this.testPoints.get(id) || null;
  };

  SensorLabScene.prototype.isToolEnabled = function (toolId) {
    return Array.from(this.assets.values()).some((asset) =>
      asset.kind === "diagnostic-tool" && asset.toolId === toolId && asset.enabled
    );
  };

  SensorLabScene.prototype.isToolDeclared = function (toolId) {
    return (this.runtime?.toolIds || []).includes(toolId);
  };

  SensorLabScene.prototype.getProbe = function (id) {
    return this.probes.get(id) || null;
  };

  SensorLabScene.prototype.getProbes = function () {
    return Array.from(this.probes.values());
  };

  SensorLabScene.prototype.dockProbe = function (probeId, testPointId) {
    const probe = this.probes.get(probeId);
    if (!probe || !this.testPoints.has(testPointId)) return false;
    probe.dockedTestPointId = testPointId;
    return true;
  };

  SensorLabScene.prototype.undockProbe = function (probeId) {
    const probe = this.probes.get(probeId);
    if (!probe) return false;
    probe.dockedTestPointId = null;
    return true;
  };

  SensorLabScene.prototype.setActiveFault = function (faultId) {
    if (faultId && !(this.template?.faultCatalog || []).some((fault) => fault.id === faultId)) return false;
    this.activeFault = faultId || null;
    return true;
  };

  SensorLabScene.prototype.getActiveFault = function () {
    return this.activeFault;
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { SensorLabScene, assertGovernance, AUTHORITY_FLAGS };
  }
  if (typeof window !== "undefined") {
    window.AutoLearnProPresentation = window.AutoLearnProPresentation || {};
    window.AutoLearnProPresentation.SensorLabScene = SensorLabScene;
    window.AutoLearnProPresentation.assertGovernance = assertGovernance;
  }
})();