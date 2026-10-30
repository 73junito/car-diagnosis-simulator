const { ensureTeacherFixture, probeTeacherCredentials, getUserFromToken } = require('../scripts/smoke-test');

const STAGING_URL = 'https://jchfruprqpeypdttvlam.supabase.co';
const TEACHER_ID = '33333333-3333-4333-8333-333333333333';
const TEACHER_EMAIL = 'staging-teacher@r26.test';

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/**
 * Stubs every HTTP call the fixture makes. `signIn` decides what the credential probe
 * sees, so each test can express intent (verified, rejected, outage, ...).
 */
function makeFetch({ teacherExists = true, signIn = () => response(200, { access_token: 'token' }) } = {}) {
  const calls = [];
  const fetchImpl = jest.fn(async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ url, method, body: options.body });
    if (url.includes('/auth/v1/admin/users?page=')) {
      return response(200, { users: teacherExists ? [{ id: TEACHER_ID, email: TEACHER_EMAIL }] : [] });
    }
    if (url.endsWith('/auth/v1/admin/users') && method === 'POST') {
      return response(200, { id: TEACHER_ID });
    }
    if (url.includes('/auth/v1/admin/users/')) {
      return response(200, {});
    }
    if (url.includes('/auth/v1/token')) {
      return signIn();
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  });
  return { fetchImpl, calls };
}

function fixtureOptions(fetchImpl) {
  return {
    enabled: true,
    supabaseUrl: STAGING_URL,
    serviceRoleKey: 'service-role-test-key',
    anonKey: 'anon-test-key',
    email: TEACHER_EMAIL,
    password: 'configured-password',
    fetchImpl,
  };
}

const putCalls = (calls) => calls.filter((call) => call.method === 'PUT');
const tokenCalls = (calls) => calls.filter((call) => call.url.includes('/auth/v1/token'));

/**
 * A stateful stand-in for the identity provider that models the one behaviour that
 * matters here: an administrative password update revokes every live session for that
 * user. Session survival can then be asserted directly, and the "no administrative
 * update was issued" condition is instrumented (counted) instead of being inferred
 * from a successful request.
 */
function makeSessionWorld({ providerPassword = 'configured-password' } = {}) {
  const state = { password: providerPassword, sessions: new Map(), adminPasswordUpdates: 0, sequence: 0 };

  const fetchImpl = jest.fn(async (url, options = {}) => {
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const bearer = String(headers.Authorization || headers.authorization || '').replace(/^Bearer\s+/i, '');

    if (url.includes('/auth/v1/admin/users?page=')) {
      return response(200, { users: [{ id: TEACHER_ID, email: TEACHER_EMAIL }] });
    }
    if (url.includes('/auth/v1/token')) {
      const body = JSON.parse(options.body || '{}');
      if (body.password !== state.password) {
        return response(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      const token = `session-${(state.sequence += 1)}`;
      state.sessions.set(token, TEACHER_ID);
      return response(200, { access_token: token, user: { id: TEACHER_ID, email: TEACHER_EMAIL } });
    }
    if (url.includes('/auth/v1/user')) {
      const id = state.sessions.get(bearer);
      if (!id) return response(401, { error: 'Invalid or expired token' });
      return response(200, { user: { id } });
    }
    if (url.includes('/auth/v1/admin/users/') && method === 'PUT') {
      const body = JSON.parse(options.body || '{}');
      state.password = body.password;
      state.adminPasswordUpdates += 1;
      state.sessions.clear();
      return response(200, {});
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  });

  return { state, fetchImpl };
}

async function signInTwice(world, password) {
  const issue = async () => {
    const res = await world.fetchImpl(`${STAGING_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      body: JSON.stringify({ email: TEACHER_EMAIL, password }),
    });
    return (await res.json()).access_token;
  };
  return [await issue(), await issue()];
}

describe('staging teacher fixture credential handling', () => {
  test('existing teacher with a working password is preserved without an admin update', async () => {
    const { fetchImpl, calls } = makeFetch({ signIn: () => response(200, { access_token: 'live-token' }) });
    const result = await ensureTeacherFixture(fixtureOptions(fetchImpl));

    expect(result).toEqual({ action: 'preserved' });
    expect(putCalls(calls)).toHaveLength(0);
    expect(tokenCalls(calls)).toHaveLength(1);
  });

  test('a transient identity-provider failure never rotates credentials', async () => {
    const { fetchImpl, calls } = makeFetch({ signIn: () => response(503, { msg: 'upstream unavailable' }) });
    await expect(ensureTeacherFixture(fixtureOptions(fetchImpl))).rejects.toThrow(/refused to rotate/);
    expect(putCalls(calls)).toHaveLength(0);
  });

  test('a rate limit never rotates credentials', async () => {
    const { fetchImpl, calls } = makeFetch({ signIn: () => response(429, { msg: 'too many requests' }) });
    await expect(ensureTeacherFixture(fixtureOptions(fetchImpl))).rejects.toThrow(/refused to rotate/);
    expect(putCalls(calls)).toHaveLength(0);
  });

  test('a network error never rotates credentials', async () => {
    const { fetchImpl, calls } = makeFetch({
      signIn: () => {
        throw new Error('ECONNRESET');
      }
    });
    await expect(ensureTeacherFixture(fixtureOptions(fetchImpl))).rejects.toThrow(/refused to rotate/);
    expect(putCalls(calls)).toHaveLength(0);
  });

  test('a token-style 401 is not mistaken for a wrong password', async () => {
    const { fetchImpl, calls } = makeFetch({
      signIn: () => response(401, { error: 'Invalid or expired token' })
    });
    await expect(ensureTeacherFixture(fixtureOptions(fetchImpl))).rejects.toThrow(/refused to rotate/);
    expect(putCalls(calls)).toHaveLength(0);
  });

  test('an explicitly rejected password triggers one controlled recovery', async () => {
    const { fetchImpl, calls } = makeFetch({
      signIn: () => response(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
    });
    const result = await ensureTeacherFixture({ ...fixtureOptions(fetchImpl), allowPasswordReset: true });

    expect(result).toEqual({ action: 'recovered' });
    expect(putCalls(calls)).toHaveLength(1);
    expect(putCalls(calls)[0].body).toContain('configured-password');
  });

  test('the legacy invalid_grant shape also triggers recovery', async () => {
    const { fetchImpl, calls } = makeFetch({
      signIn: () => response(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
    });
    const result = await ensureTeacherFixture({ ...fixtureOptions(fetchImpl), allowPasswordReset: true });

    expect(result).toEqual({ action: 'recovered' });
    expect(putCalls(calls)).toHaveLength(1);
  });

  test('a missing identity is created and no password update is issued', async () => {
    const { fetchImpl, calls } = makeFetch({ teacherExists: false });
    const result = await ensureTeacherFixture(fixtureOptions(fetchImpl));

    expect(result).toEqual({ action: 'created' });
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expect(putCalls(calls)).toHaveLength(0);
  });

  // Two workflows can share this identity; neither may reset a working credential.
  test('two concurrent fixture runs do not rotate a valid credential', async () => {
    const { fetchImpl, calls } = makeFetch({ signIn: () => response(200, { access_token: 'live-token' }) });
    const results = await Promise.all([
      ensureTeacherFixture(fixtureOptions(fetchImpl)),
      ensureTeacherFixture(fixtureOptions(fetchImpl))
    ]);

    expect(results).toEqual([{ action: 'preserved' }, { action: 'preserved' }]);
    expect(putCalls(calls)).toHaveLength(0);
  });

  test('a missing anon key is unverifiable, not a wrong password', async () => {
    const { fetchImpl, calls } = makeFetch();
    const options = { ...fixtureOptions(fetchImpl), anonKey: '' };
    await expect(ensureTeacherFixture(options)).rejects.toThrow(/SUPABASE_ANON_KEY is missing/);
    expect(putCalls(calls)).toHaveLength(0);
  });

  test('seeding disabled performs no HTTP calls at all', async () => {
    const { fetchImpl, calls } = makeFetch();
    const result = await ensureTeacherFixture({ ...fixtureOptions(fetchImpl), enabled: false });
    expect(result).toEqual({ action: 'disabled' });
    expect(calls).toHaveLength(0);
  });

  test('an expired or invalid JWT is still rejected', async () => {
    const rejected = await getUserFromToken('expired-token', {
      supabaseUrl: STAGING_URL,
      anonKey: 'anon-test-key',
      fetchImpl: jest.fn(async () => response(401, { error: 'Invalid or expired token' })),
    });
    expect(rejected).toBeNull();

    const accepted = await getUserFromToken('live-token', {
      supabaseUrl: STAGING_URL,
      anonKey: 'anon-test-key',
      fetchImpl: jest.fn(async () => response(200, { user: { id: TEACHER_ID } })),
    });
    expect(accepted).toEqual({ id: TEACHER_ID });
  });

  test('the probe reports each outcome distinctly', async () => {
    const base = { baseUrl: STAGING_URL, anonKey: 'anon', email: TEACHER_EMAIL, password: 'p' };
    const ok = await probeTeacherCredentials({ ...base, fetchImpl: makeFetch().fetchImpl });
    expect(ok).toEqual({ status: 'ok' });

    const mismatch = await probeTeacherCredentials({
      ...base,
      fetchImpl: makeFetch({ signIn: () => response(400, { error_code: 'invalid_credentials' }) }).fetchImpl
    });
    expect(mismatch).toEqual({ status: 'mismatch' });

    const outage = await probeTeacherCredentials({
      ...base,
      fetchImpl: makeFetch({ signIn: () => response(502, {}) }).fetchImpl
    });
    expect(outage.status).toBe('unverifiable');
  });

  // Session survival, asserted against a provider model that revokes sessions on a
  // password update. Two tokens held before the fixture runs must both still resolve,
  // and the invariant is instrumented: zero administrative password updates.
  test('two live sessions survive fixture setup on the valid-credential path', async () => {
    const world = makeSessionWorld();
    const [first, second] = await signInTwice(world, 'configured-password');
    expect(world.state.sessions.size).toBe(2);

    const result = await ensureTeacherFixture(fixtureOptions(world.fetchImpl));

    expect(result).toEqual({ action: 'preserved' });
    expect(world.state.adminPasswordUpdates).toBe(0);
    // The probe signs in to verify the credential, so the fixture adds its own session
    // rather than removing any. What matters is that neither pre-existing one is gone.
    expect(world.state.sessions.has(first)).toBe(true);
    expect(world.state.sessions.has(second)).toBe(true);

    const options = { supabaseUrl: STAGING_URL, anonKey: 'anon', fetchImpl: world.fetchImpl };
    expect(await getUserFromToken(first, options)).toEqual({ id: TEACHER_ID });
    expect(await getUserFromToken(second, options)).toEqual({ id: TEACHER_ID });
  });

  // Documents the residual risk rather than hiding it: the controlled recovery path can
  // still rotate a shared credential, which is why per-run identities remain the durable
  // fix. If this ever stops revoking, revisit whether the provider changed its behaviour.
  test('the recovery path still revokes concurrent sessions (known limitation)', async () => {
    const world = makeSessionWorld();
    const [held] = await signInTwice(world, 'configured-password');
    const options = { supabaseUrl: STAGING_URL, anonKey: 'anon', fetchImpl: world.fetchImpl };
    expect(await getUserFromToken(held, options)).toEqual({ id: TEACHER_ID });

    const result = await ensureTeacherFixture({ ...fixtureOptions(world.fetchImpl), password: 'rotated-password', allowPasswordReset: true });

    expect(result).toEqual({ action: 'recovered' });
    expect(world.state.adminPasswordUpdates).toBe(1);
    expect(await getUserFromToken(held, options)).toBeNull();
  });
});
