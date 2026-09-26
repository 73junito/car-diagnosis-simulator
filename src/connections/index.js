(function () {
"use strict";

const contracts = typeof require === "function"
  ? require("./contracts")
  : window.TorqueMindConnectionContracts;

class ConnectionStyleRegistry {
  constructor(styles = []) {
    this.byId = new Map();
    for (const style of styles) this.register(style);
  }
  register(style) {
    const errors = contracts.validateConnectionStyle(style);
    if (errors.length) throw new Error(errors.join("; "));
    if (this.byId.has(style.id)) throw new Error(`duplicate connection style: ${style.id}`);
    this.byId.set(style.id, Object.freeze({ ...style }));
    return this;
  }
  get(id) { return this.byId.get(id) || null; }
  list() { return [...this.byId.values()]; }
}

async function loadConnectionStyles(basePath = "/data/connections") {
  const response = await fetch(`${basePath}/electrical.json`);
  if (!response.ok) throw new Error("Unable to load electrical connection styles.");
  const catalog = await response.json();
  return { catalog, registry: new ConnectionStyleRegistry(catalog.styles) };
}

const api = { ConnectionStyleRegistry, loadConnectionStyles };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindConnectionLibrary = api;
})();
