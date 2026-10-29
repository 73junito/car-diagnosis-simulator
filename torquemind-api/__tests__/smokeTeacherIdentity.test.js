const {
  ensureTeacherFixture,
  resolveTeacherSession,
  resolveTeacherCredentials,
  TEACHER_SCOPE_DEDICATED,
  TEACHER_SCOPE_SHARED,
  TEACHER_SCOPE_SHARED_ISOLATED,
} = require('../scripts/smoke-test');

const {
  parseArgs,
  assertOperatorContext,
  provisionTeacherIdentity,
  cleanupTeacherIdentity,
} = require('../scripts/provision-smoke-teacher-identity');

const STAGING_URL = 'https://jchfruprqpeypdttvlam.supabase.co';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createAdminStub(users = []) {
  const calls = [];
  const fetchImpl = jest.fn(async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    calls.push({
      url,
      method,
      body: init.body ? JSON.parse(init.body) : null,
    });

    if (url.includes('/auth/v1/token')) return jsonResponse({ error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
    if (method === 'GET') return jsonResponse({ users });
    if (method === 'POST') return jsonResponse({ id: 'user-created' });
    if (method === 'PUT') return jsonResponse({ id: 'user-existing' });
    if (method === 'DELETE') return jsonResponse(null, 204);
    return jsonResponse(null, 500);
  });

  return { fetchImpl, calls };
}

function createProfilesStub() {
  const upsertCalls = [];
  const deleteCalls = [];

  const query = {
    // The Supabase query builder is thenable, so awaiting it resolves the
    // query result exactly like the real client does.
    then: (resolve, reject) => Promise.resolve({ error: null }).then(resolve, reject),
    upsert: jest.fn(async (row, options) => {
      upsertCalls.push({ row, options });
      return { error: null };
    }),
    delete: jest.fn(() => query),
    eq: jest.fn((column, value) => {
      deleteCalls.push([column, value]);
      return query;
    }),
  };

  const admin = {
    from: jest.fn((table) => {
      expect(table).toBe('profiles');
      return query;
    }),
  };

  return {
    createClientImpl: jest.fn(() => admin),
    upsertCalls,
    deleteCalls,
    query,
  };
}

describe('isolated smoke teacher session resolution', () => {
  const ok = { ok: true, credentialsMissing: false, status: 200, message: null, token: 'tok', user: { id: 'u1' } };
  const rejected = { ok: false, credentialsMissing: false, status: 400, message: 'Invalid login credentials' };

  test('refuses to repair the shared identity and reports the remediation', async () => {
    const requestSignIn = jest.fn(async () => rejected);
    const ensureFixture = jest.fn(async () => ({ action: 'updated' }));

    const result = await resolveTeacherSession({
      requestSignIn,
      ensureFixture,
      mayResetPassword: false,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.repairRefused).toBe(true);
    expect(result.message).toMatch(/dedicated teacher credentials/i);
    expect(ensureFixture).toHaveBeenCalledTimes(1);
    expect(ensureFixture).toHaveBeenCalledWith({ allowPasswordReset: false });
  });

  test('never retries the sign-in when the shared identity repair is refused', async () => {
    const requestSignIn = jest.fn(async () => rejected);
    const ensureFixture = jest.fn(async () => ({ action: 'updated' }));

    await resolveTeacherSession({ requestSignIn, ensureFixture, mayResetPassword: false });

    expect(requestSignIn).toHaveBeenCalledTimes(1);
  });

  test('creates the shared identity when it is missing and retries the sign-in', async () => {
    const requestSignIn = jest.fn()
      .mockResolvedValueOnce(rejected)
      .mockResolvedValueOnce(ok);
    const ensureFixture = jest.fn(async () => ({ action: 'created' }));

    const result = await resolveTeacherSession({
      requestSignIn,
      ensureFixture,
      mayResetPassword: false,
    });

    expect(result).toBe(ok);
    expect(requestSignIn).toHaveBeenCalledTimes(2);
  });

  test('still repairs a dedicated identity after a rejected sign-in', async () => {
    const requestSignIn = jest.fn()
      .mockResolvedValueOnce(rejected)
      .mockResolvedValueOnce(ok);
    const ensureFixture = jest.fn(async () => ({ action: 'updated' }));

    const result = await resolveTeacherSession({
      requestSignIn,
      ensureFixture,
      mayResetPassword: true,
    });

    expect(result).toBe(ok);
    expect(ensureFixture).toHaveBeenCalledWith({ allowPasswordReset: true });
  });

  test('does not touch the shared identity on the healthy path', async () => {
    const requestSignIn = jest.fn(async () => ok);
    const ensureFixture = jest.fn(async () => ({ action: 'updated' }));

    const result = await resolveTeacherSession({
      requestSignIn,
      ensureFixture,
      mayResetPassword: false,
    });

    expect(result).toBe(ok);
    expect(ensureFixture).not.toHaveBeenCalled();
  });
});

describe('teacher fixture password reset guard', () => {
  test('refuses to reset the shared identity password', async () => {
    const { fetchImpl, calls } = createAdminStub([
      { id: 'user-existing', email: 'shared@example.test' },
    ]);

    await expect(
      ensureTeacherFixture({
        enabled: true,
        supabaseUrl: STAGING_URL,
        serviceRoleKey: 'service-role',
        anonKey: 'anon',
        email: 'shared@example.test',
        password: 'shared-secret',
        fetchImpl,
        allowPasswordReset: false,
      })
    ).rejects.toThrow(/password reset refused/i);

    // Lookup and credential probe are permitted; no administrative password update.
    expect(calls.map((call) => call.method)).toEqual(['GET', 'POST']);
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);
  });

  test('resets a dedicated identity password when the repair is allowed', async () => {
    const { fetchImpl, calls } = createAdminStub([
      { id: 'user-existing', email: 'dedicated@example.test' },
    ]);

    const result = await ensureTeacherFixture({
      enabled: true,
      supabaseUrl: STAGING_URL,
      serviceRoleKey: 'service-role',
      anonKey: 'anon',
      email: 'dedicated@example.test',
      password: 'dedicated-secret',
      fetchImpl,
      allowPasswordReset: true,
    });

    expect(result).toEqual({ action: 'recovered' });
    expect(calls.map((call) => call.method)).toEqual(['GET', 'POST', 'PUT']);
  });

  test('refuses to seed outside the approved staging project', async () => {
    const { fetchImpl } = createAdminStub([]);

    await expect(
      ensureTeacherFixture({
        enabled: true,
        supabaseUrl: 'https://pffdgqpynpbffbcnxmum.supabase.co',
        serviceRoleKey: 'service-role',
        email: 'dedicated@example.test',
        password: 'dedicated-secret',
        fetchImpl,
      })
    ).rejects.toThrow(/not approved staging/i);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('smoke teacher credential resolution', () => {

  test('prefers a dedicated identity over the shared one', () => {
    const credentials = resolveTeacherCredentials({
      DEDICATED_TEACHER_EMAIL: 'dedicated@example.test',
      DEDICATED_TEACHER_PASSWORD: 'dedicated-secret',
      TEST_TEACHER_EMAIL: 'shared@example.test',
      TEST_TEACHER_PASSWORD: 'shared-secret',
    });

    expect(credentials).toEqual({
      email: 'dedicated@example.test',
      password: 'dedicated-secret',
      scope: TEACHER_SCOPE_DEDICATED,
    });
  });

  test('keeps the dedicated scope even when the workflow opted into isolation', () => {
    const credentials = resolveTeacherCredentials({
      DEDICATED_TEACHER_EMAIL: 'dedicated@example.test',
      DEDICATED_TEACHER_PASSWORD: 'dedicated-secret',
      SMOKE_TEACHER_ISOLATED: 'true',
    });

    expect(credentials.scope).toBe(TEACHER_SCOPE_DEDICATED);
  });

  test('rejects a dedicated email without a password', () => {
    expect(() =>
      resolveTeacherCredentials({
        DEDICATED_TEACHER_EMAIL: 'dedicated@example.test',
        TEST_TEACHER_EMAIL: 'shared@example.test',
        TEST_TEACHER_PASSWORD: 'shared-secret',
      })
    ).toThrow(/DEDICATED_TEACHER_EMAIL was provided without DEDICATED_TEACHER_PASSWORD/);
  });

  test('rejects a dedicated password without an email', () => {
    expect(() =>
      resolveTeacherCredentials({
        DEDICATED_TEACHER_PASSWORD: 'dedicated-secret',
        TEST_TEACHER_EMAIL: 'shared@example.test',
        TEST_TEACHER_PASSWORD: 'shared-secret',
      })
    ).toThrow(/DEDICATED_TEACHER_PASSWORD was provided without DEDICATED_TEACHER_EMAIL/);
  });

  test('falls back to the shared identity without changing legacy behaviour', () => {
    const credentials = resolveTeacherCredentials({
      TEST_TEACHER_EMAIL: 'shared@example.test',
      TEST_TEACHER_PASSWORD: 'shared-secret',
    });

    expect(credentials).toEqual({
      email: 'shared@example.test',
      password: 'shared-secret',
      scope: TEACHER_SCOPE_SHARED,
    });
  });

  test('marks the shared fallback as isolated when the workflow opted in', () => {
    const credentials = resolveTeacherCredentials({
      TEST_TEACHER_EMAIL: 'shared@example.test',
      TEST_TEACHER_PASSWORD: 'shared-secret',
      SMOKE_TEACHER_ISOLATED: 'true',
    });

    expect(credentials.scope).toBe(TEACHER_SCOPE_SHARED_ISOLATED);
  });
});

describe('smoke teacher identity provisioning guards', () => {
  const baseEnv = {
    SUPABASE_URL: STAGING_URL,
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    SMOKE_TEACHER_EMAIL: 'dedicated@example.test',
    SMOKE_TEACHER_PASSWORD: 'dedicated-secret',
  };

  test('parses the cleanup flag', () => {
    expect(parseArgs([])).toEqual({ cleanup: false, help: false });
    expect(parseArgs(['--cleanup'])).toEqual({ cleanup: true, help: false });
  });

  test('rejects unknown arguments', () => {
    expect(() => parseArgs(['--force'])).toThrow(/Unknown argument/);
  });

  test('refuses to run inside CI', () => {
    expect(() => assertOperatorContext({ ...baseEnv, CI: 'true' })).toThrow(/Refusing to run inside CI/);
    expect(() =>
      assertOperatorContext({ ...baseEnv, GITHUB_ACTIONS: 'true' })
    ).toThrow(/Refusing to run inside CI/);
  });

  test('refuses a destination outside the approved staging project', () => {
    expect(() =>
      assertOperatorContext({
        ...baseEnv,
        SUPABASE_URL: 'https://pffdgqpynpbffbcnxmum.supabase.co',
      })
    ).toThrow(/approved staging Supabase project/);
  });

  test('refuses to provision the shared teacher identity', () => {
    expect(() =>
      assertOperatorContext({
        ...baseEnv,
        TEST_TEACHER_EMAIL: 'dedicated@example.test',
      })
    ).toThrow(/Refusing to provision the shared teacher identity/);
  });

  test('requires the provisioning credentials', () => {
    expect(() => assertOperatorContext({ ...baseEnv, SUPABASE_URL: '' })).toThrow(/SUPABASE_URL is required/);
    expect(() =>
      assertOperatorContext({ ...baseEnv, SUPABASE_SERVICE_ROLE_KEY: '' })
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY is required/);
    expect(() =>
      assertOperatorContext({ ...baseEnv, SMOKE_TEACHER_EMAIL: '' })
    ).toThrow(/SMOKE_TEACHER_EMAIL is required/);
    expect(() =>
      assertOperatorContext({ ...baseEnv, SMOKE_TEACHER_PASSWORD: '' })
    ).toThrow(/SMOKE_TEACHER_PASSWORD is required/);
  });

  test('provisions the identity and the teacher profile', async () => {
    const { fetchImpl, calls } = createAdminStub([]);
    const profiles = createProfilesStub();

    const result = await provisionTeacherIdentity({
      supabaseUrl: STAGING_URL,
      serviceRoleKey: 'service-role',
      anonKey: 'anon',
      email: 'dedicated@example.test',
      password: 'dedicated-secret',
      fetchImpl,
      createClientImpl: profiles.createClientImpl,
    });

    expect(result).toEqual({
      action: 'created',
      userId: 'user-created',
      email: 'dedicated@example.test',
    });
    expect(calls.map((call) => call.method)).toEqual(['GET', 'POST']);
    expect(profiles.upsertCalls).toEqual([
      {
        row: { id: 'user-created', email: 'dedicated@example.test', role: 'teacher' },
        options: { onConflict: 'id', returning: 'minimal' },
      },
    ]);
  });

  test('removes the identity and the teacher profile on cleanup', async () => {
    const { fetchImpl, calls } = createAdminStub([
      { id: 'user-existing', email: 'dedicated@example.test' },
    ]);
    const profiles = createProfilesStub();

    const result = await cleanupTeacherIdentity({
      supabaseUrl: STAGING_URL,
      serviceRoleKey: 'service-role',
      anonKey: 'anon',
      email: 'dedicated@example.test',
      password: 'dedicated-secret',
      fetchImpl,
      createClientImpl: profiles.createClientImpl,
    });

    expect(result).toEqual({
      action: 'deleted',
      userId: 'user-existing',
      email: 'dedicated@example.test',
    });
    expect(calls.map((call) => call.method)).toEqual(['GET', 'DELETE']);
    expect(profiles.deleteCalls).toEqual([['id', 'user-existing']]);
  });

  test('reports an absent identity on cleanup without deleting anything', async () => {
    const { fetchImpl, calls } = createAdminStub([]);
    const profiles = createProfilesStub();

    const result = await cleanupTeacherIdentity({
      supabaseUrl: STAGING_URL,
      serviceRoleKey: 'service-role',
      anonKey: 'anon',
      email: 'dedicated@example.test',
      password: 'dedicated-secret',
      fetchImpl,
      createClientImpl: profiles.createClientImpl,
    });

    expect(result.action).toBe('absent');
    expect(calls.map((call) => call.method)).toEqual(['GET']);
    expect(profiles.query.delete).not.toHaveBeenCalled();
  });
});
