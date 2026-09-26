"use strict";

const contracts = typeof require === "function" ? require("./contracts") : window.TorqueMindSymbolContracts;

class SymbolRegistry {
  constructor() {
    this._symbols = new Map();
  }

  register(symbol) {
    const errors = contracts.validateSymbolDefinition(symbol);
    if (errors.length) throw new Error(`Invalid symbol ${symbol?.id || "<unknown>"}: ${errors.join("; ")}`);
    if (this._symbols.has(symbol.id)) throw new Error(`Duplicate symbol id: ${symbol.id}`);
    this._symbols.set(symbol.id, Object.freeze({ ...symbol }));
    return this;
  }

  registerMany(symbols) {
    for (const symbol of symbols) this.register(symbol);
    return this;
  }

  get(id) {
    return this._symbols.get(id) || null;
  }

  list(domain) {
    const values = [...this._symbols.values()];
    return domain ? values.filter((symbol) => symbol.domain === domain) : values;
  }

  search(query, domain) {
    const needle = String(query || "").trim().toLowerCase();
    return this.list(domain).filter((symbol) => {
      const haystack = [symbol.id, symbol.name, ...(symbol.aliases || []), ...(symbol.tags || [])].join(" ").toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }

  domains() {
    return [...new Set(this.list().map((symbol) => symbol.domain))].sort();
  }
}

const api = { SymbolRegistry };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindSymbolRegistry = api;
