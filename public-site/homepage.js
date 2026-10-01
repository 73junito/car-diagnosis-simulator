const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');

function setMenuOpen(open) {
  if (!navToggle || !mainNav) return;
  mainNav.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
}

navToggle?.addEventListener('click', () => {
  const open = navToggle.getAttribute('aria-expanded') !== 'true';
  setMenuOpen(open);
});

mainNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenuOpen(false));
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const wasOpen = navToggle?.getAttribute('aria-expanded') === 'true';
  setMenuOpen(false);
  if (wasOpen) navToggle?.focus();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 1020) setMenuOpen(false);
});
