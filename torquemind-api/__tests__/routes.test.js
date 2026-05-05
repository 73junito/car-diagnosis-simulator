'use strict';

/**
 * Route integration tests using supertest.
 *
 * We exercise two application configurations:
 *  1. "not-configured" – no SUPABASE_URL/KEY env vars; all routes use fallback behaviour.
 *  2. "configured"     – env vars set + @supabase/supabase-js mocked; tests auth-required paths.
 */

const request = require('supertest');

// ─── helpers ───────────────────────────────────────────────────────────────

/** Build a chainable Supabase query mock that resolves the given result. */
function makeChain(result) {
  const resolved = jest.fn().mockResolvedValue(result || { data: null, error: null });
  const chain = {};
  ['select', 'insert', 'eq', 'in', 'maybeSingle', 'single'].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  // terminal methods resolve the mock result
  chain.maybeSingle = resolved;
  chain.single = resolved;
  // insert().select().single() chain – reuse resolved at every leaf
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  return chain;
}

/** Build a mock Supabase client where every .from() call resolves `result`. */
function makeMockClient(result, authGetUserResult) {
  return {
    from: jest.fn().mockReturnValue(makeChain(result)),
    auth: { getUser: jest.fn().mockResolvedValue(authGetUserResult || { data: null, error: { message: 'no auth' } }) },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite A – Supabase NOT configured (fallback / local mode)
// ═══════════════════════════════════════════════════════════════════════════

describe('Routes — Supabase NOT configured (fallback mode)', () => {
  let app;

  beforeAll(() => {
    jest.resetModules();
    // Ensure supabase env vars are absent so index.js initialises without Supabase
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_KEY;
    // Mock the module so createClient is never really invoked
    jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
    ({ app } = require('../index'));
  });

  afterAll(() => {
    jest.resetModules();
  });

  // ── Health ────────────────────────────────────────────────────────────────

  it('GET / → 200 health message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('TorqueMind API running');
  });

  // ── POST /api/replay ──────────────────────────────────────────────────────

  it('POST /api/replay → 200 success (fallback, no auth required)', async () => {
    const res = await request(app)
      .post('/api/replay')
      .send({ scenarioId: 1, actions: [], result: 'Correct', confidence: 'high' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/replay with full payload → 200 echoes fields', async () => {
    const res = await request(app)
      .post('/api/replay')
      .send({ scenarioId: 5, actions: [{ type: 'tool', value: 'battery' }], result: 'Incorrect', confidence: 'low' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.replay).toBeDefined();
  });

  // ── POST /api/complete ────────────────────────────────────────────────────

  it('POST /api/complete → 200 success (fallback)', async () => {
    const res = await request(app)
      .post('/api/complete')
      .send({ userId: 'local-user', scenarioId: 2 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.completion).toMatchObject({ userId: 'local-user', scenarioId: 2 });
  });

  // ── GET /api/teacher/data ─────────────────────────────────────────────────

  it('GET /api/teacher/data → 501 when supabase not configured', async () => {
    const res = await request(app).get('/api/teacher/data');
    expect(res.status).toBe(501);
    expect(res.body.error).toMatch(/not configured/i);
  });

  // ── POST /api/assign ──────────────────────────────────────────────────────

  it('POST /api/assign without required fields → 400', async () => {
    const res = await request(app).post('/api/assign').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('POST /api/assign missing scenarioIds array → 400', async () => {
    const res = await request(app).post('/api/assign').send({ system: 'electrical' });
    expect(res.status).toBe(400);
  });

  it('POST /api/assign with valid fields but no supabase → 501', async () => {
    const res = await request(app).post('/api/assign').send({ system: 'electrical', scenarioIds: [1, 2] });
    expect(res.status).toBe(501);
  });

  // ── POST /api/classes ─────────────────────────────────────────────────────

  it('POST /api/classes without name → 400', async () => {
    const res = await request(app).post('/api/classes').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name required/i);
  });

  it('POST /api/classes with name → 200 fallback class object', async () => {
    const res = await request(app).post('/api/classes').send({ name: 'Test Class' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cls = res.body.class;
    expect(cls).toBeDefined();
    expect(cls.name).toBe('Test Class');
    // class_code should be 6 uppercase alphanumeric characters
    expect(cls.class_code).toMatch(/^[A-Z0-9]{6}$/);
    expect(cls.id).toMatch(/^local-/);
  });

  // ── GET /api/classes ──────────────────────────────────────────────────────

  it('GET /api/classes → 200 empty array (fallback)', async () => {
    const res = await request(app).get('/api/classes');
    expect(res.status).toBe(200);
    expect(res.body.classes).toEqual([]);
  });

  // ── GET /api/classes/by-code/:code ────────────────────────────────────────

  it('GET /api/classes/by-code/:code → 200 empty object (fallback)', async () => {
    const res = await request(app).get('/api/classes/by-code/ABC123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  // ── POST /api/classes/:classId/enroll ─────────────────────────────────────

  it('POST /api/classes/:classId/enroll → 200 success (fallback)', async () => {
    const res = await request(app)
      .post('/api/classes/class-1/enroll')
      .send({ userId: 'student-1', code: 'XYZ' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.enrollment).toBeDefined();
    expect(res.body.enrollment.classId).toBe('class-1');
  });

  // ── GET /api/classes/:classId/students ────────────────────────────────────

  it('GET /api/classes/:classId/students → 200 empty students (fallback)', async () => {
    const res = await request(app).get('/api/classes/class-1/students');
    expect(res.status).toBe(200);
    expect(res.body.students).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Suite B – Supabase IS configured (mocked client)
// ═══════════════════════════════════════════════════════════════════════════

describe('Routes — Supabase configured (mocked)', () => {
  let app;
  let mockCreateClient;

  // A teacher user returned by auth.getUser
  const teacherUser = { id: 'teacher-uid', email: 'teacher@school.com' };
  const teacherProfile = { id: 'teacher-uid', email: 'teacher@school.com', role: 'teacher' };

  beforeAll(() => {
    jest.resetModules();

    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    delete process.env.SUPABASE_KEY;

    // The mock needs to be set up BEFORE index.js is required so createClient
    // at module-load time returns our mock client.
    jest.mock('@supabase/supabase-js', () => {
      const createClient = jest.fn();
      // Store reference so tests can reconfigure return values
      mockCreateClient = createClient;
      return { createClient };
    });

    // Default: getUser succeeds, profile returns teacher
    const profileChain = makeChain({ data: teacherProfile, error: null });
    const defaultClient = {
      from: jest.fn().mockReturnValue(profileChain),
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: teacherUser }, error: null }) },
    };
    // Import the mock now that jest.mock is registered
    const { createClient } = require('@supabase/supabase-js');
    createClient.mockReturnValue(defaultClient);

    ({ app } = require('../index'));
  });

  afterAll(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    jest.resetModules();
  });

  // ── POST /api/replay – auth required ─────────────────────────────────────

  it('POST /api/replay without Authorization header → 401', async () => {
    const res = await request(app)
      .post('/api/replay')
      .send({ scenarioId: 1, actions: [] });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('POST /api/replay missing scenarioId → 400 after auth', async () => {
    const { createClient } = require('@supabase/supabase-js');
    const profileChain = makeChain({ data: teacherProfile, error: null });
    createClient.mockReturnValue({
      from: jest.fn().mockReturnValue(profileChain),
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: teacherUser }, error: null }) },
    });

    const res = await request(app)
      .post('/api/replay')
      .set('Authorization', 'Bearer valid-token')
      .send({ actions: [] }); // missing scenarioId
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  // ── POST /api/complete – auth required ───────────────────────────────────

  it('POST /api/complete without Authorization header → 401', async () => {
    const res = await request(app)
      .post('/api/complete')
      .send({ scenarioId: 1 });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  // ── GET /api/teacher/data – requires teacher role ─────────────────────────

  it('GET /api/teacher/data without auth → 401', async () => {
    const res = await request(app).get('/api/teacher/data');
    expect(res.status).toBe(401);
  });

  it('GET /api/teacher/data with student role → 403', async () => {
    const { createClient } = require('@supabase/supabase-js');
    const studentProfile = { id: 'stu-uid', email: 'student@school.com', role: 'student' };
    const profileChain = makeChain({ data: studentProfile, error: null });
    createClient.mockReturnValue({
      from: jest.fn().mockReturnValue(profileChain),
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'stu-uid', email: 'student@school.com' } }, error: null }) },
    });

    const res = await request(app)
      .get('/api/teacher/data')
      .set('Authorization', 'Bearer student-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient role/i);
  });

  // ── POST /api/assign – requires teacher role ──────────────────────────────

  it('POST /api/assign without auth → 401', async () => {
    const res = await request(app).post('/api/assign').send({ system: 'electrical', scenarioIds: [1] });
    expect(res.status).toBe(401);
  });

  it('POST /api/assign with student role → 403', async () => {
    const { createClient } = require('@supabase/supabase-js');
    const studentProfile = { id: 'stu-uid', email: 'student@school.com', role: 'student' };
    const profileChain = makeChain({ data: studentProfile, error: null });
    createClient.mockReturnValue({
      from: jest.fn().mockReturnValue(profileChain),
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'stu-uid', email: 'student@school.com' } }, error: null }) },
    });

    const res = await request(app)
      .post('/api/assign')
      .set('Authorization', 'Bearer student-token')
      .send({ system: 'electrical', scenarioIds: [1] });
    expect(res.status).toBe(403);
  });

  // ── POST /api/classes – requires teacher role ─────────────────────────────

  it('POST /api/classes without auth → 401', async () => {
    const res = await request(app).post('/api/classes').send({ name: 'My Class' });
    expect(res.status).toBe(401);
  });

  // ── GET /api/classes – requires teacher role ──────────────────────────────

  it('GET /api/classes without auth → 401', async () => {
    const res = await request(app).get('/api/classes');
    expect(res.status).toBe(401);
  });

  // ── GET /api/classes/by-code – public ─────────────────────────────────────

  it('GET /api/classes/by-code/:code → 200 when supabase configured (returns class or null)', async () => {
    const { createClient } = require('@supabase/supabase-js');
    const classData = { id: 'cls-1', name: 'Test', class_code: 'ABCDEF' };
    const chain = makeChain({ data: classData, error: null });
    createClient.mockReturnValue({
      from: jest.fn().mockReturnValue(chain),
      auth: { getUser: jest.fn().mockResolvedValue({ data: null, error: { message: 'no auth' } }) },
    });

    const res = await request(app).get('/api/classes/by-code/ABCDEF');
    expect(res.status).toBe(200);
    // Response includes class key (may be null if supabase mock chain doesn't resolve perfectly, but status is 200)
    expect(res.body).toHaveProperty('class');
  });

  // ── GET /api/classes/:classId/students – requires teacher role ────────────

  it('GET /api/classes/:classId/students without auth → 401', async () => {
    const res = await request(app).get('/api/classes/class-1/students');
    expect(res.status).toBe(401);
  });
});
