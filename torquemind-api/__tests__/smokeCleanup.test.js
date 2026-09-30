const { cleanupSmokeClass } = require('../scripts/smoke-test');

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
