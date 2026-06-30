import { mountShell } from "../shell.js";

export function initDashboardShell() {
  mountShell();

  document.documentElement.classList.add("tm-dashboard-shell-ready");
}

export function createDashboardHero({ eyebrow = "", title = "", subtitle = "" } = {}) {
  return `
    <section class="tm-dashboard-hero">
      ${eyebrow ? `<div class="tm-eyebrow">${eyebrow}</div>` : ""}
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ""}
    </section>
  `;
}
