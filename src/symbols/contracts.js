(function () {
"use strict";

const SYMBOL_DOMAINS = Object.freeze(["electrical", "hydraulic", "pneumatic", "mechanical", "thermal"]);
const SYMBOL_STATUSES = Object.freeze(["project-authored", "reference-aligned", "deprecated"]);
const PRIMITIVE_TYPES = Object.freeze(["line", "rect", "circle", "ellipse", "path", "polyline", "polygon", "text"]);

const STANDARD_REFERENCES = Object.freeze({
  electrical: Object.freeze(["IEC 60617:2026 DB", "ISO 14617-1:2025"]),
  hydraulic: Object.freeze(["ISO 1219-1:2012", "ISO 1219-1:2012/Amd 1:2016", "ISO 14617-1:2025"]),
  pneumatic: Object.freeze(["ISO 1219-1:2012", "ISO 1219-1:2012/Amd 1:2016", "ISO 14617-1:2025"]),
  mechanical: Object.freeze(["ISO 14617-1:2025"]),
  thermal: Object.freeze(["ISO 14617-1:2025"])
});

function validateSymbolDefinition(symbol) {
  const errors = [];
  if (!symbol || typeof symbol !== "object") return ["symbol must be an object"];
  if (!symbol.id || typeof symbol.id !== "string") errors.push("id is required");
  if (!SYMBOL_DOMAINS.includes(symbol.domain)) errors.push(`unsupported domain: ${symbol.domain}`);
  if (!symbol.name || typeof symbol.name !== "string") errors.push("name is required");
  if (!Array.isArray(symbol.primitives) || symbol.primitives.length === 0) errors.push("primitives are required");
  for (const primitive of symbol.primitives || []) {
    if (!PRIMITIVE_TYPES.includes(primitive.type)) errors.push(`unsupported primitive: ${primitive.type}`);
  }
  if (!Array.isArray(symbol.terminals)) errors.push("terminals must be an array");
  return errors;
}

const api = { SYMBOL_DOMAINS, SYMBOL_STATUSES, PRIMITIVE_TYPES, STANDARD_REFERENCES, validateSymbolDefinition };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindSymbolContracts = api;
})();
