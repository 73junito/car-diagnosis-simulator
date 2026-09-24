export const ROUTES = Object.freeze({
  HOME: '/',
  DOCS: '/docs',
  CONTACT: '/contact.html',
  PRIVACY: '/privacy.html',
  TERMS: '/terms.html'
});

export function route(name) {
  return ROUTES[name] || '/';
}
