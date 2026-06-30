export function quickActions(actions = []) {
  if (!actions.length) return "";

  return `
    <section class="tm-panel">
      <h2 class="tm-panel-title">Quick Actions</h2>
      <div class="tm-stat-row">
        ${actions.map((action) =>
          `<a class="tm-btn tm-btn-primary" href="${action.href}">${action.label}</a>`
        ).join("")}
      </div>
    </section>
  `;
}
