export function learningPath({
  title = "Learning Path",
  items = []
} = {}) {
  const rows = items.map((item) => {
    const label = item.label || "Module";
    const completed = Number(item.completed || 0);
    const total = Number(item.total || 0);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return `
      <div class="tm-learning-path__item">
        <span class="tm-learning-path__label">${label}</span>
        <strong class="tm-learning-path__value">${completed} / ${total}</strong>
        <div class="tm-learning-path__bar" aria-label="${label} ${percent}% complete">
          <span class="tm-learning-path__fill" style="width:${percent}%"></span>
        </div>
      </div>
    `;
  }).join("");

  return `
    <section class="tm-learning-path">
      <h2 class="tm-learning-path__title">${title}</h2>
      ${rows}
    </section>
  `;
}
