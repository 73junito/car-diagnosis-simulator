import { NAV_ITEMS } from './navigation.js';

export function renderShellHeader(activeHref = window.location.pathname) {
  const current = activeHref.endsWith('/') ? activeHref : `${activeHref}/`;

  return `
    <header class="tm-topbar">
      <div class="tm-topbar-inner">
        <div class="tm-brand">TorqueMind</div>
        <nav class="tm-nav" aria-label="Primary navigation">
          ${NAV_ITEMS.map((item) => {
            const href = item.href.endsWith('/') ? item.href : `${item.href}/`;
            const active = current === href ? ' aria-current="page"' : '';
            return `<a href="${item.href}"${active}>${item.label}</a>`;
          }).join('')}
        </nav>
      </div>
    </header>
  `;
}

export function mountShell() {
  const target = document.querySelector('[data-theme-shell]');
  if (target) {
    target.innerHTML = renderShellHeader();
  }
}
