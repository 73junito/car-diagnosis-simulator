"use strict";
/* Presentation-only inspection presets shared by equipment viewers.
   No electrical model, measurement, fault, or assessment data is modified. */
(function exposeEquipmentInspection(global) {
  const presets = Object.freeze({
    overview: Object.freeze({ yaw: -0.55, pitch: 0.28, zoom: 0.78, label: "Overview" }),
    front: Object.freeze({ yaw: 0, pitch: 0.05, zoom: 1.0, label: "Front" }),
    terminals: Object.freeze({ yaw: -0.35, pitch: -0.65, zoom: 1.2, label: "Top / terminals" }),
    detail: Object.freeze({ yaw: 0.45, pitch: 0.20, zoom: 1.35, label: "Detail" })
  });
  function apply(viewer, presetName) {
    const preset = presets[presetName];
    if (!preset || !viewer || typeof viewer.render !== "function") return false;
    if (!viewer.drawables || !viewer.drawables.length) return false;
    viewer.yaw = preset.yaw;
    viewer.pitch = preset.pitch;
    viewer.zoom = preset.zoom;
    viewer.render();
    return true;
  }
  function mount({ viewer, container, status }) {
    if (!container || !viewer || !status) return;
    const buttons = [];
    for (const [key, preset] of Object.entries(presets)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = preset.label;
      button.dataset.inspectionView = key;
      button.setAttribute("aria-pressed", String(key === "overview"));
      button.addEventListener("click", () => {
        if (!apply(viewer, key)) {
          status.textContent = "Select an enabled equipment model before choosing an inspection view.";
          return;
        }
        buttons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        status.textContent = preset.label + " equipment view. Presentation only; electrical readings and diagnostic eligibility are unchanged.";
      });
      container.append(button);
      buttons.push(button);
    }
  }
  global.AutoLearnProEquipmentInspection = Object.freeze({ presets, apply, mount });
})(typeof window === "undefined" ? globalThis : window);
