export const ROUTES = Object.freeze({
  HOME: '/',
  STUDENT_DASHBOARD: '/dashboard/student/',
  STUDENT_SCENARIO: '/dashboard/student/scenario/',
  ANALYTICS: '/dashboard/analytics',
  SESSION_HISTORY: '/dashboard/session-history',
  DOCS: '/docs'
});

export function route(name) {
  return ROUTES[name] || '/';
}
