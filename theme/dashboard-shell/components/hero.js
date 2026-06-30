export function dashboardHero({ eyebrow = "", title = "", subtitle = "" } = {}) {
  return `
    <section class="tm-dashboard-hero">
      ${eyebrow ? `<div class="tm-eyebrow">${eyebrow}</div>` : ""}
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ""}
    </section>
  `;
}
