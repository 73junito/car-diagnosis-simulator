const NAV_ITEMS = Object.freeze([
  { label: "Exam home", href: "/", match: (path) => path === "/" },
  { label: "Course catalog", href: "/catalog/", match: (path) => path.startsWith("/catalog/") },
  { label: "Academic pathways", href: "/learning-path/", match: (path) => path.startsWith("/learning-path/") },
  { label: "Lesson plans", href: "/lesson-plans/", match: (path) => path.startsWith("/lesson-plans/") },
  { label: "Program architecture", href: "/program-architecture/", match: (path) => path.startsWith("/program-architecture/") },
  { label: "Curriculum standards", href: "/curriculum-standards/", match: (path) => path.startsWith("/curriculum-standards/") },
  { label: "Exam preview", href: "/exam/", match: (path) => path.startsWith("/exam/") },
  { label: "Training app", href: "https://app.autolearnpro.com/", external: true }
]);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function renderNavigation() {
  const main = document.querySelector("main#main");
  if (!main || main.closest(".exam-shell-layout")) return;

  const path = window.location.pathname;
  const sidebar = document.createElement("aside");
  sidebar.className = "exam-sidebar";
  sidebar.setAttribute("aria-label", "Exam navigation");

  const links = NAV_ITEMS.map((item) => {
    const active = !item.external && item.match && item.match(path);
    const current = active ? ' aria-current="page"' : "";
    const external = item.external ? ' target="_blank" rel="noopener noreferrer"' : "";
    const suffix = item.external ? ' <span aria-hidden="true">↗</span>' : "";
    return '<a href="' + escapeHtml(item.href) + '"' + current + external + '>' +
      escapeHtml(item.label) + suffix + '</a>';
  }).join("");
  sidebar.innerHTML =
    '<div class="exam-sidebar-head"><strong>Navigate</strong><span>Academic & training</span></div>' +
    '<nav>' + links + '</nav>';

  const layout = document.createElement("div");
  layout.className = "exam-shell-layout";
  main.parentNode.insertBefore(layout, main);
  layout.append(sidebar, main);
  document.body.classList.add("has-exam-sidebar");

  document.querySelectorAll('.site-header nav[aria-label="Primary"], footer .footer-links')
    .forEach((node) => node.setAttribute("hidden", ""));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderNavigation, { once: true });
} else {
  renderNavigation();
}

export { NAV_ITEMS };
