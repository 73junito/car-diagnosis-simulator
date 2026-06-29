export const API = Object.freeze({
  ANALYTICS_EXPORT: '/api/analytics/export',
  ANALYTICS_SESSIONS: '/api/analytics/sessions',
  ANALYTICS_STUDENTS: '/api/analytics/students',
  TELEMETRY_EVENTS: '/api/telemetry/events',
  TELEMETRY_HISTORY: '/api/telemetry/history',
  ATTEMPTS_SAVE: '/api/attempts/save',
  ATTEMPTS_LOAD: '/api/attempts/load',
  AUTH_ROLE: '/api/auth/role'
});

export function api(name) {
  return API[name] || '';
}
