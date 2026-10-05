const {
  createProductionPersistenceRuntime,
  resolveProductionPersistenceConfig,
} = require('../src/ai/runtime/production-persistence-runtime');

describe('Phase 9 production runtime persistence wiring', () => {
  const productionEnv = {
    TORQUEMIND_ENVIRONMENT: 'production',
    TORQUEMIND_ORCHESTRATION_PERSISTENCE: 'supabase',
    TORQUEMIND_ORCHESTRATION_SUPABASE_PROJECT_REF: 'pffdgqpynpbffbcnxmum',
    SUPABASE_URL: 'https://pffdgqpynpbffbcnxmum.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role-placeholder',
  };

  test('disabled mode does not require privileged Supabase configuration', () => {
    expect(resolveProductionPersistenceConfig({
      TORQUEMIND_ENVIRONMENT: 'preview',
      TORQUEMIND_ORCHESTRATION_PERSISTENCE: 'disabled',
    })).toEqual({
      enabled: false,
      mode: 'disabled',
      environment: 'preview',
      credentialSource: null,
      projectRef: null,
    });
  });

  test('supabase mode fails closed when the privileged key is missing', () => {
    expect(() => resolveProductionPersistenceConfig({
      ...productionEnv,
      SUPABASE_SERVICE_ROLE_KEY: '',
    })).toThrow(/configuration incomplete/);
  });

  test('production project reference mismatch fails closed', () => {
    expect(() => resolveProductionPersistenceConfig({
      ...productionEnv,
      SUPABASE_URL: 'https://wrongproject.supabase.co',
    })).toThrow(/project reference mismatch/);
  });

  test('new Supabase secret key is preferred over legacy service_role', () => {
    const config = resolveProductionPersistenceConfig({
      ...productionEnv,
      SUPABASE_SECRET_KEY: 'sb_secret_placeholder',
    });

    expect(config.credentialSource).toBe('SUPABASE_SECRET_KEY');
    expect(config.credential).toBe('sb_secret_placeholder');
  });

  test('runtime creates the existing lease/CAS coordinator over Supabase RPC', async () => {
    const calls = [];
    const fakeClient = {
      rpc: async (name, params) => {
        calls.push({ name, params });
        if (name === 'orchestration_acquire_lease') {
          return { data: { lease_token: 'lease-token' }, error: null };
        }
        if (name === 'orchestration_load_entries') {
          return { data: [], error: null };
        }
        if (name === 'orchestration_append_entry') {
          return {
            data: {
              runId: params.p_run_id,
              actor: params.p_actor,
              action: params.p_action,
              state: params.p_state,
              recordedAt: params.p_recorded_at,
              metadata: JSON.parse(params.p_metadata_json),
              integrityHash: params.p_integrity_hash,
            },
            error: null,
          };
        }
        if (name === 'orchestration_release_lease') {
          return { data: { released: true }, error: null };
        }
        return { data: null, error: null };
      },
    };
    const createClientImpl = jest.fn(() => fakeClient);

    const runtime = createProductionPersistenceRuntime({
      env: productionEnv,
      workerId: 'production-worker-a',
      createClientImpl,
    });

    expect(runtime.enabled).toBe(true);
    expect(runtime.projectRef).toBe('pffdgqpynpbffbcnxmum');
    expect(runtime.credentialSource).toBe('SUPABASE_SERVICE_ROLE_KEY');

    await runtime.coordinator.append({
      runId: 'phase9-runtime-test',
      actor: 'question-agent',
      action: 'step-started',
      state: 'final_content_approved',
      metadata: { requestId: 'phase9-request' },
    });

    expect(createClientImpl).toHaveBeenCalledWith(
      productionEnv.SUPABASE_URL,
      productionEnv.SUPABASE_SERVICE_ROLE_KEY,
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
          autoRefreshToken: false,
        }),
      })
    );

    expect(calls.map((call) => call.name)).toEqual([
      'orchestration_acquire_lease',
      'orchestration_load_entries',
      'orchestration_append_entry',
      'orchestration_release_lease',
    ]);
  });
});
