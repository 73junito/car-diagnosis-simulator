"use strict";

const catalogRoot = document.getElementById("catalog");
const domainFilter = document.getElementById("domainFilter");
const searchInput = document.getElementById("searchInput");
const summary = document.getElementById("summary");

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

async function init() {
  try {
    libraryState = await window.TorqueMindSymbolLibrary.loadCatalogs("/data/symbols");
    for (const domain of libraryState.registry.domains()) {
      const option = document.createElement("option");
      option.value = domain;
      option.textContent = domain[0].toUpperCase() + domain.slice(1);
      domainFilter.append(option);
    }
    domainFilter.addEventListener("change", render);
    searchInput.addEventListener("input", render);
    render();
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
