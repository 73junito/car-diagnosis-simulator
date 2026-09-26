"use strict";

const contracts = typeof require === "function" ? require("./contracts") : window.TorqueMindSymbolContracts;
const registryApi = typeof require === "function" ? require("./registry") : window.TorqueMindSymbolRegistry;

function normalizeCatalog(catalog) {
  if (!catalog || !Array.isArray(catalog.symbols)) throw new Error("Invalid symbol catalog");
  return catalog.symbols.map((symbol) => ({
    ...symbol,
    standardReferences: symbol.standardReferences || catalog.standardReferences || [],
    catalogVersion: catalog.version,
    catalogStatus: catalog.status
  }));
}

function createRegistryFromCatalogs(catalogs) {
  const registry = new registryApi.SymbolRegistry();
  for (const catalog of catalogs) registry.registerMany(normalizeCatalog(catalog));
  return registry;
}

async function loadCatalogs(baseUrl = "/data/symbols") {
  const manifestResponse = await fetch(`${baseUrl}/manifest.json`);
  if (!manifestResponse.ok) throw new Error(`Unable to load symbol manifest: ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  const catalogs = [];
  for (const domain of manifest.domains) {
    const response = await fetch(`${baseUrl}/${domain.file}`);
    if (!response.ok) throw new Error(`Unable to load symbol catalog ${domain.id}: ${response.status}`);
    catalogs.push(await response.json());
  }
  return { manifest, catalogs, registry: createRegistryFromCatalogs(catalogs) };
}

const api = { normalizeCatalog, createRegistryFromCatalogs, loadCatalogs, STANDARD_REFERENCES: contracts.STANDARD_REFERENCES };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindSymbolLibrary = api;
