export function heroBanner({
  eyebrow = "",
  title = "",
  subtitle = "",
  status = "",
  actions = []
} = {}) {
  const actionMarkup = actions.length
    ? `<div class="tm-hero-banner__actions">
        ${actions.map((action) =>
          `<a class="tm-btn ${action.variant === "secondary" ? "tm-btn-secondary" : "tm-btn-primary"}" href="${action.href || "#"}">${action.label || "Action"}</a>`
        ).join("")}
      </div>`
    : "";

  return `
    <section class="tm-hero-banner">
      <div>
        ${eyebrow ? `<p class="tm-hero-banner__eyebrow">${eyebrow}</p>` : ""}
        ${title ? `<h1 class="tm-hero-banner__title">${title}</h1>` : ""}
        ${subtitle ? `<p class="tm-hero-banner__subtitle">${subtitle}</p>` : ""}
        ${status ? `<span class="tm-hero-banner__status">${status}</span>` : ""}
      </div>
      ${actionMarkup}
    </section>
  `;
}
