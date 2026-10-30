const { cleanupSmokeClass, resolveTeacherSession } = require('../scripts/smoke-test');

describe('smoke class cleanup', () => {
  test('deletes only the exact smoke class row', async () => {
    const classId = '11111111-1111-4111-8111-111111111111';
    const userId = '22222222-2222-4222-8222-222222222222';
    const className = 'Smoke Test Class 1234567890';
    const eqCalls = [];

    const query = {
      delete: jest.fn(() => query),
      eq: jest.fn((column, value) => {
        eqCalls.push([column, value]);
        return query;
      }),
      select: jest.fn(async () => ({ data: [{ id: classId }], error: null })),
    };
    const admin = {
      from: jest.fn((table) => {
        expect(table).toBe('classes');
        return query;
      }),
    };
    const createClientImpl = jest.fn(() => admin);

    const result = await cleanupSmokeClass({
      classId,
      className,
      userId,
      supabaseUrl: 'https://jchfruprqpeypdttvlam.supabase.co',
      serviceRoleKey: 'test-service-role',
      createClientImpl,
    });

    expect(result).toEqual({ action: 'deleted', classId });
    expect(eqCalls).toEqual([
      ['id', classId],
      ['owner_id', userId],
      ['name', className],
    ]);
    expect(query.delete).toHaveBeenCalledTimes(1);
    expect(query.select).toHaveBeenCalledWith('id');
  });

  test('refuses a non-smoke class name before creating an admin client', async () => {
    const createClientImpl = jest.fn();

    await expect(cleanupSmokeClass({
      classId: '11111111-1111-4111-8111-111111111111',
      className: 'Real Classroom',
      userId: '22222222-2222-4222-8222-222222222222',
      supabaseUrl: 'https://jchfruprqpeypdttvlam.supabase.co',
      serviceRoleKey: 'test-service-role',
      createClientImpl,
    })).rejects.toThrow(/not an exact smoke-test fixture/i);

    expect(createClientImpl).not.toHaveBeenCalled();
  });

  test('refuses cleanup outside the approved staging Supabase project', async () => {
    const createClientImpl = jest.fn();

    await expect(cleanupSmokeClass({
      classId: '11111111-1111-4111-8111-111111111111',
      className: 'Smoke Test Class 1234567890',
      userId: '22222222-2222-4222-8222-222222222222',
      supabaseUrl: 'https://pffdgqpynpbffbcnxmum.supabase.co',
      serviceRoleKey: 'test-service-role',
      createClientImpl,
    })).rejects.toThrow(/not approved staging/i);

    expect(createClientImpl).not.toHaveBeenCalled();
  });

  test('treats local fallback classes as a no-op', async () => {
    await expect(cleanupSmokeClass({
      classId: 'local-123',
      className: 'Smoke Test Class 1234567890',
      userId: 'teacher-1',
    })).resolves.toEqual({ action: 'local-noop' });
  });
});

describe('staging smoke teacher session resolution', () => {
  const ok = { ok: true, credentialsMissing: false, status: 200, message: null, token: 'tok', user: { id: 'u1' } };
  const rejected = { ok: false, credentialsMissing: false, status: 400, message: 'Invalid login credentials' };

  test('does not reset the shared teacher password when sign-in already works', async () => {
    // Resetting the password revokes every session the user holds, which is
    // what breaks a concurrently running sibling smoke workflow. On the
    // healthy path the fixture must not be touched at all.
    const requestSignIn = jest.fn(async () => ok);
    const ensureFixture = jest.fn(async () => ({ action: 'updated' }));

    const result = await resolveTeacherSession({ requestSignIn, ensureFixture });

    expect(result).toBe(ok);
    expect(requestSignIn).toHaveBeenCalledTimes(1);
    expect(ensureFixture).not.toHaveBeenCalled();
  });

  test('repairs the shared identity and retries once when sign-in is rejected', async () => {
    const requestSignIn = jest.fn()
      .mockResolvedValueOnce(rejected)
      .mockResolvedValueOnce(ok);
    const ensureFixture = jest.fn(async () => ({ action: 'updated' }));

    const result = await resolveTeacherSession({ requestSignIn, ensureFixture });

    expect(result).toBe(ok);
    expect(ensureFixture).toHaveBeenCalledTimes(1);
    expect(requestSignIn).toHaveBeenCalledTimes(2);
  });

  test('reports a rejected sign-in after the repair attempt without looping', async () => {
    const requestSignIn = jest.fn(async () => rejected);
    const ensureFixture = jest.fn(async () => ({ action: 'updated' }));

    const result = await resolveTeacherSession({ requestSignIn, ensureFixture });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(ensureFixture).toHaveBeenCalledTimes(1);
    expect(requestSignIn).toHaveBeenCalledTimes(2);
  });

  test('does not retry when fixture seeding is disabled', async () => {
    const requestSignIn = jest.fn(async () => rejected);
    const ensureFixture = jest.fn(async () => ({ action: 'disabled' }));

    const result = await resolveTeacherSession({ requestSignIn, ensureFixture });

    expect(result.ok).toBe(false);
    expect(ensureFixture).toHaveBeenCalledTimes(1);
    expect(requestSignIn).toHaveBeenCalledTimes(1);
  });

  test('does not reset the shared password after a transient sign-in failure', async () => {
    // A rate limit or upstream 5xx is not a credential problem. Repairing the
    // identity here would revoke every session the shared teacher holds and
    // break a concurrently running sibling smoke workflow.
    const transient = { ok: false, credentialsMissing: false, status: 429, message: 'Too many requests' };
    const requestSignIn = jest.fn(async () => transient);
    const ensureFixture = jest.fn(async () => ({ action: 'updated' }));

    const result = await resolveTeacherSession({ requestSignIn, ensureFixture });

    expect(result).toBe(transient);
    expect(ensureFixture).not.toHaveBeenCalled();
    expect(requestSignIn).toHaveBeenCalledTimes(1);
  });

  test('surfaces missing credentials without retrying the password grant', async () => {
    const missing = { ok: false, credentialsMissing: true, status: null, message: 'Supabase test credentials not provided.' };
    const requestSignIn = jest.fn(async () => missing);
    const ensureFixture = jest.fn(async () => ({ action: 'updated' }));

    const result = await resolveTeacherSession({ requestSignIn, ensureFixture });

    expect(result).toBe(missing);
    expect(result.credentialsMissing).toBe(true);
    expect(requestSignIn).toHaveBeenCalledTimes(1);
  });
});
