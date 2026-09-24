import { ROUTES } from '../config/routes.js';

/*
 * Navigation intentionally lists every currently shipped, non-paid product
 * surface. Paid/entitlement-only features must not be added here until their
 * access contract is explicitly approved.
 */
export const NAV_ITEMS = Object.freeze([
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Student', href: ROUTES.STUDENT_DASHBOARD },
  { label: 'Activity', href: ROUTES.STUDENT_ACTIVITY },
  { label: 'Coach', href: ROUTES.STUDENT_COACH },
  { label: 'Learning Path', href: ROUTES.STUDENT_LEARNING_PATH },
  { label: 'Transcript', href: ROUTES.STUDENT_TRANSCRIPT },
  { label: 'Student Diagnostics', href: ROUTES.DIAGNOSTICS_STUDENT },
  { label: 'Live Diagnostics', href: ROUTES.DIAGNOSTICS_LIVE },
  { label: 'Instructor Analytics', href: ROUTES.INSTRUCTOR_ANALYTICS },
  { label: 'Live Session', href: ROUTES.INSTRUCTOR_LIVE_SESSION },
  { label: 'Session History', href: ROUTES.INSTRUCTOR_SESSION_HISTORY },
  { label: 'Authoring Studio', href: ROUTES.AUTHORING_STUDIO },
  { label: 'Docs', href: ROUTES.DOCS }
]);
