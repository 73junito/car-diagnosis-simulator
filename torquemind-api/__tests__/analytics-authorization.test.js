'use strict';

/*
 * Security regression tests for the /api/analytics/* authorization boundary.
 *
 * Boundary under test (torquemind-api/index.js): every /api/analytics/* route
 * is registered behind requireRole('teacher'), applied at route registration
 * only. Shared auth utilities are unchanged, so local-dev fail-open behavior
 * (Supabase not configured) is preserved and asserted here too.
 *
 * Scope note: this guards the route-level role gate. It does NOT assert
 * instructor->student scoping, because no such ownership model exists yet —
 * instructor-specific reporting remains blocked by design.
 */

const request = require('supertest');

const ANALYTICS_ROUTES = [
  '/api/analytics/sessions',
  '/api/analytics/students',
  '/api/analytics/export?format=csv',
  '/api/analytics/cohort',
  '/api/analytics/heatmap',
];

// Minimal Supabase client factory sufficient for auth + role resolution.
function createClientFactory({ user, profile } = {}) {
  const authedClient = {
    from: (table) => {
      const q = {};
      q.select = jest.fn().mockReturnValue(q);
      q.eq = jest.fn().mockReturnValue(q);
      q.maybeSingle = jest.fn().mockResolvedValue({
        data: table === 'profiles' && profile ? profile : null,
        error: null,
      });
      return q;
    },
  };
  return jest.fn().mockImplementation(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue(
        user ? { data: { user }, error: null } : { data: { user: null }, error: null }
      ),
    },
    from: (table) => authedClient.from(table),
  }));
}

function loadApp({ user, profile, configured = true } = {}) {
  jest.resetModules();
  if (configured) {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    delete process.env.SUPABASE_KEY;
  } else {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_KEY;
  }

  const createClient = createClientFactory({ user, profile });
  jest.doMock('@supabase/supabase-js', () => ({ createClient }));
  // Keep telemetry instructor gate out of the way; these tests target analytics.
  jest.doMock('../../api/telemetry/access', () => ({
    requireInstructor: (req, res, next) => next(),
  }));

  const { app } = require('../index');
  return { app };
}

describe('analytics route authorization boundary', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_KEY;
  });

  describe('when Supabase is configured (production-like)', () => {
    it('returns 401 for unauthenticated requests to every analytics route', async () => {
      const { app } = loadApp({ user: null, configured: true });
      for (const route of ANALYTICS_ROUTES) {
        const res = await request(app).get(route);
        expect(res.status).toBe(401);
      }
    });

    it('returns 403 for an authenticated non-teacher (student) on every analytics route', async () => {
      const student = { id: 'student-1', email: 'student@example.com' };
      const profile = { id: 'student-1', role: 'student' };
      const { app } = loadApp({ user: student, profile, configured: true });
      for (const route of ANALYTICS_ROUTES) {
        const res = await request(app).get(route).set('Authorization', 'Bearer token');
        expect(res.status).toBe(403);
      }
    });

    it('allows an authenticated teacher through the gate on every analytics route', async () => {
      const teacher = { id: 'teacher-1', email: 'teacher@example.com' };
      const profile = { id: 'teacher-1', role: 'teacher' };
      const { app } = loadApp({ user: teacher, profile, configured: true });
      for (const route of ANALYTICS_ROUTES) {
        const res = await request(app).get(route).set('Authorization', 'Bearer token');
        // Passed the gate (200 from handler), not 401/403.
        expect(res.status).toBe(200);
      }
    });
  });

  describe('when Supabase is not configured (local dev fallback, unchanged)', () => {
    it('falls through the gate for every analytics route (documented dev behavior)', async () => {
      const { app } = loadApp({ user: null, configured: false });
      for (const route of ANALYTICS_ROUTES) {
        const res = await request(app).get(route);
        expect(res.status).toBe(200);
      }
    });
  });
});
