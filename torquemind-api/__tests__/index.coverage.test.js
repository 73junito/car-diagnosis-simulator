'use strict';

const request = require('supertest');

function deepCloneTables(tables) {
  return Object.fromEntries(Object.entries(tables || {}).map(([k, v]) => [k, Array.isArray(v) ? v.map((r) => ({ ...r })) : []]));
}

function createClientFactory({ user, profile, tables = {}, failures = {} } = {}) {
  const state = {
    nextId: 1,
    tables: deepCloneTables(tables),
    failures,
  };

  function applyFilters(rows, filters) {
    return filters.reduce((acc, filter) => {
      if (filter.type === 'eq') return acc.filter((r) => r[filter.key] === filter.value);
      if (filter.type === 'in') return acc.filter((r) => (filter.values || []).includes(r[filter.key]));
      return acc;
    }, rows);
  }

  function makeQuery(table) {
    const q = { mode: 'select', filters: [] };
    const getFailure = () => state.failures[`${q.mode}:${table}`];
    const currentRows = () => state.tables[table] || [];

    q.select = jest.fn().mockReturnValue(q);
    q.insert = jest.fn().mockImplementation((rows) => {
      q.mode = 'insert';
      q.insertRows = rows || [];
      return q;
    });
    q.eq = jest.fn().mockImplementation((key, value) => {
      q.filters.push({ type: 'eq', key, value });
      return q;
    });
    q.in = jest.fn().mockImplementation((key, values) => {
      q.filters.push({ type: 'in', key, values });
      return q;
    });

    const resolve = () => {
      const forcedError = getFailure();
      if (forcedError) return { data: null, error: { message: forcedError } };

      if (q.mode === 'insert') {
        const inserted = (q.insertRows || []).map((row) => {
          const out = { ...row };
          if (typeof out.id === 'undefined') out.id = `${table}-${state.nextId++}`;
          if (typeof out.created_at === 'undefined') out.created_at = '2026-01-01T00:00:00.000Z';
          return out;
        });
        state.tables[table] = [...currentRows(), ...inserted];
        return { data: inserted, error: null };
      }

      return { data: applyFilters(currentRows(), q.filters), error: null };
    };

    q.maybeSingle = jest.fn().mockImplementation(async () => {
      const { data, error } = resolve();
      return { data: error ? null : (data && data[0]) || null, error };
    });

    q.single = jest.fn().mockImplementation(async () => {
      const { data, error } = resolve();
      return { data: error ? null : (data && data[0]) || null, error };
    });

    q.then = (onFulfilled, onRejected) => Promise.resolve(resolve()).then(onFulfilled, onRejected);
    return q;
  }

  return jest.fn().mockImplementation(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue(user ? { data: { user }, error: null } : { data: { user: null }, error: null }),
    },
    from: jest.fn().mockImplementation((table) => {
      if (table === 'profiles' && profile) {
        state.tables.profiles = state.tables.profiles || [];
        if (!state.tables.profiles.find((r) => r.id === profile.id)) state.tables.profiles.push({ ...profile });
      }
      return makeQuery(table);
    }),
  }));
}

function loadApp({ user, profile, tables, failures }) {
  jest.resetModules();
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  delete process.env.SUPABASE_KEY;

  const createClient = createClientFactory({ user, profile, tables, failures });
  jest.doMock('@supabase/supabase-js', () => ({ createClient }));
  const { app } = require('../index');
  return { app, createClient };
}

describe('index.js route coverage additions', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_KEY;
  });

  it('creates and lists classes for a teacher', async () => {
    const teacher = { id: 'teacher-1', email: 'teacher@example.com' };
    const profile = { id: 'teacher-1', role: 'teacher' };
    const { app } = loadApp({ user: teacher, profile, tables: { classes: [] } });

    const createRes = await request(app)
      .post('/api/classes')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Engine Basics' });

    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.class.name).toBe('Engine Basics');
    expect(createRes.body.class.owner_id).toBe('teacher-1');

    const listRes = await request(app)
      .get('/api/classes')
      .set('Authorization', 'Bearer token');

    expect(listRes.status).toBe(200);
    expect(listRes.body.classes).toEqual(expect.arrayContaining([expect.objectContaining({ owner_id: 'teacher-1', name: 'Engine Basics' })]));
  });

  it('returns class-scoped teacher analytics data', async () => {
    const teacher = { id: 'teacher-1', email: 'teacher@example.com' };
    const profile = { id: 'teacher-1', role: 'teacher' };
    const { app } = loadApp({
      user: teacher,
      profile,
      tables: {
        classes: [{ id: 'class-1', owner_id: 'teacher-1', class_code: 'ABC123', name: 'Section A' }],
        enrollments: [{ class_id: 'class-1', user_id: 'student-1' }],
        users: [{ id: 'student-1', role: 'student' }, { id: 'student-2', role: 'student' }],
        replays: [{ id: 'r1', user_id: 'student-1', scenario_id: 's1' }],
        completions: [{ id: 'c1', user_id: 'student-1', scenario_id: 's1' }],
        assignments: [{ id: 'a1', class_id: 'class-1', scenario_ids: ['s1'] }],
      },
    });

    const res = await request(app)
      .get('/api/teacher/data?classId=class-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.classes).toEqual([expect.objectContaining({ id: 'class-1' })]);
    expect(res.body.users).toEqual([expect.objectContaining({ id: 'student-1' })]);
    expect(res.body.replays).toEqual([expect.objectContaining({ user_id: 'student-1' })]);
    expect(res.body.completions).toEqual([expect.objectContaining({ user_id: 'student-1' })]);
    expect(res.body.assignments).toEqual([expect.objectContaining({ class_id: 'class-1' })]);
    expect(res.body.enrollments).toEqual([expect.objectContaining({ class_id: 'class-1', user_id: 'student-1' })]);
  });

  it('returns 404 for unknown class on class-scoped teacher analytics request', async () => {
    const teacher = { id: 'teacher-1' };
    const profile = { id: 'teacher-1', role: 'teacher' };
    const { app } = loadApp({ user: teacher, profile, tables: { classes: [] } });

    const res = await request(app)
      .get('/api/teacher/data?classId=missing')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/class not found/i);
  });

  it('returns 500 for class lookup by code when Supabase errors', async () => {
    const { app } = loadApp({
      user: { id: 'teacher-1' },
      profile: { id: 'teacher-1', role: 'teacher' },
      failures: { 'select:classes': 'db unavailable' },
    });

    const res = await request(app).get('/api/classes/by-code/ABC123');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/db unavailable/i);
  });

  it('handles enroll route branches for teacher and student flows', async () => {
    const teacher = { id: 'teacher-1' };
    const teacherProfile = { id: 'teacher-1', role: 'teacher' };
    const { app } = loadApp({
      user: teacher,
      profile: teacherProfile,
      tables: { classes: [{ id: 'class-1', class_code: 'JOIN12' }], enrollments: [] },
    });

    const teacherEnroll = await request(app)
      .post('/api/classes/class-1/enroll')
      .set('Authorization', 'Bearer token')
      .send({ userId: 'student-2' });
    expect(teacherEnroll.status).toBe(200);
    expect(teacherEnroll.body.enrollment).toEqual(expect.objectContaining({ class_id: 'class-1', user_id: 'student-2' }));

    const studentApp = loadApp({
      user: { id: 'student-1' },
      profile: { id: 'student-1', role: 'student' },
      tables: { classes: [{ id: 'class-1', class_code: 'JOIN12' }], enrollments: [] },
    }).app;

    const missingCode = await request(studentApp)
      .post('/api/classes/class-1/enroll')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(missingCode.status).toBe(400);

    const badCode = await request(studentApp)
      .post('/api/classes/class-1/enroll')
      .set('Authorization', 'Bearer token')
      .send({ code: 'BAD' });
    expect(badCode.status).toBe(403);

    const noAuth = await request(studentApp)
      .post('/api/classes/class-1/enroll')
      .send({ code: 'JOIN12' });
    expect(noAuth.status).toBe(401);

    const joined = await request(studentApp)
      .post('/api/classes/class-1/enroll')
      .set('Authorization', 'Bearer token')
      .send({ code: 'JOIN12' });
    expect(joined.status).toBe(200);
    expect(joined.body.enrollment).toEqual(expect.objectContaining({ class_id: 'class-1', user_id: 'student-1' }));
  });

  it('returns 500 for enroll when class lookup fails', async () => {
    const { app } = loadApp({
      user: { id: 'student-1' },
      profile: { id: 'student-1', role: 'student' },
      failures: { 'select:classes': 'lookup failed' },
    });

    const res = await request(app)
      .post('/api/classes/class-1/enroll')
      .set('Authorization', 'Bearer token')
      .send({ code: 'JOIN12' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/lookup failed/i);
  });

  it('returns students for class, empty students, and 500 on data access failure', async () => {
    const teacher = { id: 'teacher-1' };
    const profile = { id: 'teacher-1', role: 'teacher' };

    const populatedApp = loadApp({
      user: teacher,
      profile,
      tables: {
        enrollments: [{ class_id: 'class-1', user_id: 'student-1' }],
        users: [{ id: 'student-1', role: 'student' }],
      },
    }).app;

    const populated = await request(populatedApp)
      .get('/api/classes/class-1/students')
      .set('Authorization', 'Bearer token');
    expect(populated.status).toBe(200);
    expect(populated.body.students).toEqual([expect.objectContaining({ id: 'student-1' })]);

    const emptyApp = loadApp({
      user: teacher,
      profile,
      tables: { enrollments: [], users: [{ id: 'student-1', role: 'student' }] },
    }).app;
    const empty = await request(emptyApp)
      .get('/api/classes/class-1/students')
      .set('Authorization', 'Bearer token');
    expect(empty.status).toBe(200);
    expect(empty.body.students).toEqual([]);

    const failingApp = loadApp({
      user: teacher,
      profile,
      failures: { 'select:enrollments': 'enrollment read failed' },
    }).app;
    const failing = await request(failingApp)
      .get('/api/classes/class-1/students')
      .set('Authorization', 'Bearer token');
    expect(failing.status).toBe(500);
    expect(failing.body.error).toMatch(/enrollment read failed/i);
  });

  it('returns 500 when completion insert fails', async () => {
    const { app } = loadApp({
      user: { id: 'student-1' },
      profile: { id: 'student-1', role: 'student' },
      failures: { 'insert:completions': 'completion write failed' },
    });

    const res = await request(app)
      .post('/api/complete')
      .set('Authorization', 'Bearer token')
      .send({ scenarioId: 'startup' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/completion write failed/i);
  });

  it('serves telemetry history through the main app instance', async () => {
    jest.resetModules();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    delete process.env.SUPABASE_KEY;

    const createClient = createClientFactory({});
    const listTelemetryEvents = jest.fn().mockResolvedValue({
      ok: true,
      data: [{ id: 'event-1', session_id: 'session-1' }],
    });

    jest.doMock('@supabase/supabase-js', () => ({ createClient }));
    jest.doMock('../../api/telemetry/storage', () => ({ listTelemetryEvents }));

    const { app } = require('../index');
    const res = await request(app)
      .get('/api/telemetry/history')
      .query({ session: 'session-1', limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: [{ id: 'event-1', session_id: 'session-1' }],
    });
    expect(listTelemetryEvents).toHaveBeenCalledWith({ sessionId: 'session-1', limit: 10 });
  });
});
