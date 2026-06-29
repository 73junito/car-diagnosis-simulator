import { ROUTES } from '../config/routes.js';

export const NAV_ITEMS = Object.freeze([
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Student Dashboard', href: ROUTES.STUDENT_DASHBOARD },
  { label: 'Analytics', href: ROUTES.ANALYTICS },
  { label: 'Session History', href: ROUTES.SESSION_HISTORY },
  { label: 'Docs', href: ROUTES.DOCS }
]);
