export function transcriptCard({
  title = "Transcript",
  items = []
} = {}) {
  const rows = items.map((item) => `
    <article class="tm-transcript-card__item">
      <span class="tm-transcript-card__label">${item.label || ""}</span>
      <strong class="tm-transcript-card__value">${item.value || ""}</strong>
      ${item.hint ? `<small class="tm-transcript-card__hint">${item.hint}</small>` : ""}
    </article>
  `).join("");

  return `
    <section class="tm-transcript-card">
      <h2 class="tm-transcript-card__title">${title}</h2>
      <div class="tm-transcript-card__grid">
        ${rows}
      </div>
    </section>
  `;
}
