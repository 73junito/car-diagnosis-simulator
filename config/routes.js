export const ROUTES = Object.freeze({
  HOME: '/',
  STUDENT_DASHBOARD: '/dashboard/student/',
  STUDENT_ACTIVITY: '/dashboard/student/activity/',
  STUDENT_COACH: '/dashboard/student/coach/',
  STUDENT_LEARNING_PATH: '/dashboard/student/learning-path/',
  STUDENT_TRANSCRIPT: '/dashboard/student/transcript/',
  STUDENT_SCENARIO: '/dashboard/student/scenario/',
  DIAGNOSTICS_LIVE: '/dashboard/obd2.html',
  DIAGNOSTICS_STUDENT: '/dashboard/obd2-student.html',
  INSTRUCTOR_ANALYTICS: '/dashboard/instructor/analytics.html',
  INSTRUCTOR_LIVE_SESSION: '/dashboard/instructor/live-session.html',
  INSTRUCTOR_SESSION_HISTORY: '/dashboard/instructor/session-history.html',
  AUTHORING_STUDIO: '/dashboard/author/',
  DOCS: '/docs'
});

export function route(name) {
  return ROUTES[name] || '/';
}
