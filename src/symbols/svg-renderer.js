(function () {
"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";

function createSvgElement(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  return node;
}

function renderSymbol(svg, symbol, options = {}) {
  if (!svg || typeof document === "undefined") throw new Error("renderSymbol requires a browser SVG element");
  const scale = options.scale || 1;
  const tx = options.x || 0;
  const ty = options.y || 0;
  const group = createSvgElement("g", {
    class: ["tm-symbol", `tm-symbol-${symbol.domain}`, options.className || ""].filter(Boolean).join(" "),
    "data-symbol-id": symbol.id,
    transform: `translate(${tx} ${ty}) scale(${scale})`,
    role: options.role || "img",
    "aria-label": options.ariaLabel || symbol.name
  });

  for (const primitive of symbol.primitives) {
    const attrs = { ...primitive.attrs };
    if (primitive.className) attrs.class = primitive.className;
    const node = createSvgElement(primitive.type, attrs);
    if (primitive.text) node.textContent = primitive.text;
    group.append(node);
  }

  svg.append(group);
  return group;
}

const api = { SVG_NS, createSvgElement, renderSymbol };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindSymbolRenderer = api;
})();
