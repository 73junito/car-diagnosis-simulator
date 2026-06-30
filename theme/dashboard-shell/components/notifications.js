export function notificationArea(message = "") {
  if (!message) return "";

  return `
    <section class="tm-panel" role="status" aria-live="polite">
      ${message}
    </section>
  `;
}
