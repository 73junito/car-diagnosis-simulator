"use strict";

const catalogRoot = document.getElementById("catalog");
const domainFilter = document.getElementById("domainFilter");
const searchInput = document.getElementById("searchInput");
const summary = document.getElementById("summary");
const connectionStylesRoot = document.getElementById("connectionStyles");
const connectionCount = document.getElementById("connectionCount");
const voltageExamplesRoot = document.getElementById("voltageExamples");

let libraryState = null;

function createSymbolSvg(symbol) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", symbol.name);
  window.TorqueMindSymbolRenderer.renderSymbol(svg, symbol);
  return svg;
}

function createCard(symbol) {
  const card = document.createElement("article");
  card.className = "symbol-card";
  const canvas = document.createElement("div");
  canvas.className = "symbol-canvas";
  canvas.append(createSymbolSvg(symbol));
  const heading = document.createElement("h3");
  heading.textContent = symbol.name;
  const id = document.createElement("code");
  id.className = "symbol-id";
  id.textContent = symbol.id;
  const meta = document.createElement("div");
  meta.className = "symbol-meta";
  const terminalCount = symbol.terminals?.length || 0;
  const tags = (symbol.tags || []).join(", ");
  meta.textContent = terminalCount + " terminal" + (terminalCount === 1 ? "" : "s") + (tags ? " • " + tags : "");
  card.append(canvas, heading, id, meta);
  return card;
}

function render() {
  if (!libraryState) return;
  const domain = domainFilter.value;
  const query = searchInput.value;
  const matches = libraryState.registry.search(query, domain || undefined);
  catalogRoot.replaceChildren();

  const grouped = new Map();
  for (const symbol of matches) {
    if (!grouped.has(symbol.domain)) grouped.set(symbol.domain, []);
    grouped.get(symbol.domain).push(symbol);
  }

  for (const [domainName, symbols] of grouped) {
    const section = document.createElement("section");
    section.className = "domain-section";
    const heading = document.createElement("div");
    heading.className = "domain-heading";
    const title = document.createElement("h2");
    title.textContent = domainName;
    const count = document.createElement("small");
    count.textContent = symbols.length + " symbol" + (symbols.length === 1 ? "" : "s");
    heading.append(title, count);
    const grid = document.createElement("div");
    grid.className = "symbol-grid";
    for (const symbol of symbols) grid.append(createCard(symbol));
    section.append(heading, grid);
    catalogRoot.append(section);
  }

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No symbols match the current filter.";
    catalogRoot.append(empty);
  }

  summary.textContent = matches.length + " of " + libraryState.registry.list().length + " symbols";
}

function renderConnectionStyles(styles) {
  connectionStylesRoot.replaceChildren();
  for (const style of styles) {
    const card = document.createElement("article");
    card.className = "connection-card";
    const swatch = document.createElement("div");
    swatch.className = "connection-swatch";
    const swatchSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    swatchSvg.setAttribute("viewBox", "0 0 180 60");
    swatchSvg.setAttribute("aria-hidden", "true");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "14");
    line.setAttribute("y1", "30");
    line.setAttribute("x2", "166");
    line.setAttribute("y2", "30");
    line.setAttribute("class", `connection-line connection-role-${style.strokeRole}`);
    line.setAttribute("stroke-width", String(style.strokeWidth));
    if (style.dashPattern) line.setAttribute("stroke-dasharray", style.dashPattern);
    swatchSvg.append(line);
    swatch.append(swatchSvg);
    const heading = document.createElement("h3");
    heading.textContent = style.name;
    const id = document.createElement("code");
    id.className = "symbol-id";
    id.textContent = style.id;
    const meta = document.createElement("p");
    meta.className = "symbol-meta";
    meta.textContent = `${style.semanticType.replaceAll("_", " ")} • ${style.voltageSystemRequired ? "declared voltage required" : "voltage optional"}`;
    card.append(swatch, heading, id, meta);
    connectionStylesRoot.append(card);
  }
  connectionCount.textContent = `${styles.length} styles`;
}

function renderVoltageExamples() {
  const examples = [
    { powertrainType: "conventional-12v", system: { id:"LV12", systemType:"low-voltage", nominalVoltage:12, displayLabel:"12 V nominal" }, note:"Conventional automotive example" },
    { powertrainType: "other", system: { id:"LV24", systemType:"low-voltage", nominalVoltage:24, displayLabel:"24 V nominal" }, note:"Declared 24 V system" },
    { powertrainType: "hybrid", system: { id:"LV48", systemType:"low-voltage", nominalVoltage:48, displayLabel:"48 V nominal" }, note:"Declared 48 V domain" },
    { powertrainType: "battery-electric", system: { id:"HV-DEMO", systemType:"traction", nominalVoltage:400, displayLabel:"400 V nominal — example only" }, note:"Traction voltage must use the actual declared vehicle/system value" }
  ];
  voltageExamplesRoot.replaceChildren();
  for (const example of examples) {
    const domain = window.TorqueMindVoltageDomains.describeVoltageArchitecture({
      powertrainType: example.powertrainType,
      voltageSystems: [example.system]
    })[0];
    const card = document.createElement("article");
    card.className = `voltage-card voltage-domain-${domain.domainClass}`;
    const eyebrow = document.createElement("small");
    eyebrow.textContent = domain.powertrainLabel;
    const value = document.createElement("strong");
    value.textContent = domain.label;
    const note = document.createElement("span");
    note.textContent = example.note;
    card.append(eyebrow, value, note);
    voltageExamplesRoot.append(card);
  }
}

async function init() {
  try {
    libraryState = await window.TorqueMindSymbolLibrary.loadCatalogs("/data/symbols");
    for (const domain of libraryState.registry.domains()) {
      const option = document.createElement("option");
      option.value = domain;
      option.textContent = domain[0].toUpperCase() + domain.slice(1);
      domainFilter.append(option);
    }
    const connectionLibrary = await window.TorqueMindConnectionLibrary.loadConnectionStyles("/data/connections");
    domainFilter.addEventListener("change", render);
    searchInput.addEventListener("input", render);
    render();
    renderConnectionStyles(connectionLibrary.registry.list());
    renderVoltageExamples();
  } catch (error) {
    console.error(error);
    summary.textContent = "Library failed to load";
    const failure = document.createElement("div");
    failure.className = "empty-state";
    failure.textContent = "Unable to load the symbol library: " + error.message;
    catalogRoot.replaceChildren(failure);
  }
}

init();
