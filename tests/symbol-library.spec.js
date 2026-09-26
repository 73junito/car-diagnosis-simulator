"use strict";

const fs = require("fs");
const path = require("path");
const { SymbolRegistry } = require("../src/symbols/registry");
const { validateSymbolDefinition } = require("../src/symbols/contracts");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

describe("standardized symbol library", () => {
  const root = path.resolve(__dirname, "..");
  const data = path.join(root, "data", "symbols");
  const manifest = readJson(path.join(data, "manifest.json"));
  const catalogs = manifest.domains.map((domain) => readJson(path.join(data, domain.file)));
  const symbols = catalogs.flatMap((catalog) => catalog.symbols);

  test("contains the expected initial domains and symbol count", () => {
    expect(manifest.domains.map((entry) => entry.id)).toEqual([
      "electrical", "hydraulic", "pneumatic", "mechanical", "thermal"
    ]);
    expect(symbols).toHaveLength(65);
  });

  test("all definitions satisfy the core symbol contract", () => {
    for (const symbol of symbols) expect(validateSymbolDefinition(symbol)).toEqual([]);
  });

  test("registry supports domain listing and aliases/tags search", () => {
    const registry = new SymbolRegistry().registerMany(symbols);
    expect(registry.list("hydraulic")).toHaveLength(11);
    expect(registry.list("electrical")).toHaveLength(29);
    expect(registry.search("air tank", "pneumatic").map((symbol) => symbol.id)).toContain("pneumatic.receiver");
    expect(registry.search("charging", "electrical").map((symbol) => symbol.id)).toContain("electrical.alternator");
  });

  test("registry rejects duplicate symbol identifiers", () => {
    const registry = new SymbolRegistry();
    registry.register(symbols[0]);
    expect(() => registry.register(symbols[0])).toThrow(/Duplicate symbol id/);
  });
});
