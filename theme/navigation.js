import { ROUTES } from '../config/routes.js';

export const NAV_ITEMS = Object.freeze([
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Student', href: ROUTES.STUDENT_DASHBOARD },
  { label: 'Analytics', href: ROUTES.ANALYTICS },
  { label: 'History', href: ROUTES.SESSION_HISTORY },
  { label: 'Docs', href: ROUTES.DOCS }
]);
