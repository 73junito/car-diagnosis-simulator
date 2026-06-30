export function statCard({
  label = '',
  value = '',
  hint = '',
  tone = ''
} = {}) {
  const toneClass = tone ? ` tm-stat-card--${tone}` : '';

  return `
    <article class="tm-stat-card${toneClass}">
      <span class="tm-stat-card__label">${label}</span>
      <strong class="tm-stat-card__value">${value}</strong>
      ${hint ? `<small class="tm-stat-card__hint">${hint}</small>` : ''}
    </article>
  `;
}
