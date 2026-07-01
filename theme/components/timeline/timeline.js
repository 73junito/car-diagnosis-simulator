export function timeline({
  title = "Recent Activity",
  items = []
} = {}) {
  const rows = items.map((item) => `
    <li class="tm-timeline__item">
      <strong class="tm-timeline__title">${item.title || ""}</strong>
      <span class="tm-timeline__text">${item.text || ""}</span>
    </li>
  `).join("");

  return `
    <section class="dashboard-card tm-timeline-card">
      <h2>${title}</h2>
      <ol class="tm-timeline">${rows}</ol>
    </section>
  `;
}
