(function () {
"use strict";

const CONNECTION_STYLE_ROLES = Object.freeze([
  "power", "switched-power", "ground", "control", "signal", "network", "shield", "traction"
]);

function validateConnectionStyle(style) {
  const errors = [];
  if (!style || typeof style !== "object") return ["connection style must be an object"];
  if (!/^electrical\.[a-z0-9-]+$/.test(style.id || "")) errors.push("connection style id is invalid");
  if (!style.name) errors.push(`${style.id || "style"} requires name`);
  if (!style.semanticType) errors.push(`${style.id || "style"} requires semanticType`);
  if (!CONNECTION_STYLE_ROLES.includes(style.strokeRole)) errors.push(`${style.id || "style"} has unsupported strokeRole`);
  if (!(Number.isFinite(style.strokeWidth) && style.strokeWidth > 0)) errors.push(`${style.id || "style"} requires positive strokeWidth`);
  if (!(style.dashPattern === null || typeof style.dashPattern === "string")) errors.push(`${style.id || "style"} dashPattern must be null or string`);
  if (typeof style.voltageSystemRequired !== "boolean") errors.push(`${style.id || "style"} requires voltageSystemRequired boolean`);
  return errors;
}

const api = { CONNECTION_STYLE_ROLES, validateConnectionStyle };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindConnectionContracts = api;
})();
