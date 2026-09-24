import { ROUTES } from '../config/routes.js';

/*
 * Public navigation is intentionally limited to non-paid surfaces.
 * Training and assessment routes are entitlement-controlled product surfaces
 * and must not be advertised here until their server-side access gate is live.
 */
export const NAV_ITEMS = Object.freeze([
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Docs', href: ROUTES.DOCS },
  { label: 'Contact', href: ROUTES.CONTACT },
  { label: 'Privacy', href: ROUTES.PRIVACY },
  { label: 'Terms', href: ROUTES.TERMS }
]);
