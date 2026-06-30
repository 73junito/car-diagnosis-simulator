export function coachPanel({
  title = "TorqueMind Coach",
  recommendation = "",
  body = "",
  items = []
} = {}) {
  const list = items.length
    ? `<ul class="tm-coach-panel__list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`
    : "";

  return `
    <section class="tm-coach-panel">
      <h2 class="tm-coach-panel__title">${title}</h2>
      ${recommendation ? `<p class="tm-coach-panel__recommendation"><strong>Recommended next:</strong> ${recommendation}</p>` : ""}
      ${body ? `<p class="tm-coach-panel__body">${body}</p>` : ""}
      ${list}
    </section>
  `;
}
