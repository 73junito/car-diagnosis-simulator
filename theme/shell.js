import { workspaceNavFor } from './navigation.js';

function normalizeHref(value) {
  if (!value) return '/';
  const url = String(value).split('?')[0].split('#')[0];
  return url.endsWith('/') ? url : `${url}/`;
}

export function renderShellHeader(
  activeHref = window.location.pathname,
  search = window.location.search
) {
  const current = normalizeHref(activeHref);
  const items = workspaceNavFor(activeHref, search);

  return `
    <a class="tm-skip-link" href="#main-content">Skip to main content</a>
    <header class="tm-topbar">
      <div class="tm-topbar-inner">
        <a class="tm-brand" href="/dashboard/student/" aria-label="AutoLearnPro workspace home">AutoLearnPro</a>
        <nav class="tm-nav" aria-label="Workspace navigation">
          ${items.map((item) => {
            const href = normalizeHref(item.href);
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
  const main = document.querySelector('main');
  if (main && !main.id) main.id = 'main-content';
  if (main && main.id !== 'main-content') {
    main.setAttribute('tabindex', '-1');
  }
  if (target) {
    target.innerHTML = renderShellHeader();
  }
}
