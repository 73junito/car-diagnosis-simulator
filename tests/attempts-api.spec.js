/** @jest-environment node */

describe('Attempts API endpoints (mocked Supabase)', () => {
  let originalSupabaseUrl;
  let originalSupabaseAnonKey;
  let hadSupabaseUrl;
  let hadSupabaseAnonKey;

  beforeAll(() => {
    hadSupabaseUrl = Object.prototype.hasOwnProperty.call(process.env, 'SUPABASE_URL');
    hadSupabaseAnonKey = Object.prototype.hasOwnProperty.call(process.env, 'SUPABASE_ANON_KEY');
    originalSupabaseUrl = process.env.SUPABASE_URL;
    originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
  });

  afterAll(() => {
    if (hadSupabaseUrl) {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    } else {
      delete process.env.SUPABASE_URL;
    }

    if (hadSupabaseAnonKey) {
      process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    } else {
      delete process.env.SUPABASE_ANON_KEY;
    }
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('save endpoint returns 200 with id on success', async () => {
    // Mock supabase client
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'abc-123' }, error: null }) }) })
        }),
      }),
    }), { virtual: true });

    const save = require('../api/attempts/save');

    const req = { method: 'POST', body: { scenario: 'no-start', workflow_type: 'student' } };
    const res = { statusCode: 200, body: null, status(code){ this.statusCode = code; return this; }, json(obj){ this.body = obj; } };

    await save(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('id', 'abc-123');
  });

  test('load endpoint returns attempt when present', async () => {
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          select: () => ({
            eq: function(){ return this; },
            order: function(){ return this; },
            limit: function(){ return Promise.resolve({ data: [{ id: 'abc-123', scenario: 'no-start' }], error: null }); }
          })
        }),
      }),
    }), { virtual: true });

    const load = require('../api/attempts/load');
    const req = { method: 'GET', query: { scenario: 'no-start', user_id: 'user-1' } };
    const res = { statusCode: 200, body: null, status(code){ this.statusCode = code; return this; }, json(obj){ this.body = obj; } };

    await load(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('attempt');
    expect(res.body.attempt).toHaveProperty('id', 'abc-123');
  });

});
/** @jest-environment node */

describe('Attempts API endpoints (mocked Supabase)', () => {
  let originalSupabaseUrl;
  let originalSupabaseAnonKey;
  let hadSupabaseUrl;
  let hadSupabaseAnonKey;

  beforeAll(() => {
    hadSupabaseUrl = Object.prototype.hasOwnProperty.call(process.env, 'SUPABASE_URL');
    hadSupabaseAnonKey = Object.prototype.hasOwnProperty.call(process.env, 'SUPABASE_ANON_KEY');
    originalSupabaseUrl = process.env.SUPABASE_URL;
    originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
  });

  afterAll(() => {
    if (hadSupabaseUrl) {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    } else {
      delete process.env.SUPABASE_URL;
    }

    if (hadSupabaseAnonKey) {
      process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    } else {
      delete process.env.SUPABASE_ANON_KEY;
    }
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('save endpoint returns 200 with id on success', async () => {
    // Mock supabase client
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'abc-123' }, error: null }) }) })
        }),
      }),
    }), { virtual: true });

    const save = require('../api/attempts/save');

    const req = { method: 'POST', body: { scenario: 'no-start', workflow_type: 'student' } };
    const res = { statusCode: 200, body: null, status(code){ this.statusCode = code; return this; }, json(obj){ this.body = obj; } };

    await save(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('id', 'abc-123');
  });

  test('load endpoint returns attempt when present', async () => {
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          select: () => ({
            eq: function(){ return this; },
            order: function(){ return this; },
            limit: function(){ return Promise.resolve({ data: [{ id: 'abc-123', scenario: 'no-start' }], error: null }); }
          })
        }),
      }),
    }), { virtual: true });

    const load = require('../api/attempts/load');
    const req = { method: 'GET', query: { scenario: 'no-start' } };
    const res = { statusCode: 200, body: null, status(code){ this.statusCode = code; return this; }, json(obj){ this.body = obj; } };

    await load(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('attempt');
    expect(res.body.attempt).toHaveProperty('id', 'abc-123');
  });

});
