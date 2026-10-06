const { hashEntry } = require('../src/ai/governance/integrity-chain');
const HumanGateController = require('../src/ai/runtime/human-gate-controller');
const {
  createProductionAIOrchestrator,
} = require('../src/ai/runtime/production-ai-runtime');

function createBackend() {
  const state = {
    entries: new Map(),
    checkpoints: new Map(),
    leases: new Map(),
    leaseCounter: 0,
  };

  const entriesFor = (runId) => {
    if (!state.entries.has(runId)) state.entries.set(runId, []);
    return state.entries.get(runId);
  };

  const requireLease = (runId, workerId, token) => {
    const lease = state.leases.get(runId);
    if (!lease || lease.workerId !== workerId || lease.token !== token) {
      throw new Error('lease_not_owned');
    }
  };

  async function rpc(name, params) {
    try {
      if (name === 'orchestration_load_entries') {
        return { data: JSON.parse(JSON.stringify(entriesFor(params.p_run_id))) };
      }

      if (name === 'orchestration_acquire_lease') {
        const token = `lease-${++state.leaseCounter}`;
        state.leases.set(params.p_run_id, {
          workerId: params.p_worker_id,
          token,
        });
        return { data: { lease_token: token } };
      }

      if (name === 'orchestration_release_lease') {
        requireLease(params.p_run_id, params.p_worker_id, params.p_lease_token);
        state.leases.delete(params.p_run_id);
        return { data: { released: true } };
      }

      if (name === 'orchestration_append_entry') {
        requireLease(params.p_run_id, params.p_worker_id, params.p_lease_token);
        const entries = entriesFor(params.p_run_id);
        if (params.p_expected_version !== entries.length) {
          return { error: { message: 'version_conflict' } };
        }

        const previousHash = entries.length
          ? entries[entries.length - 1].integrityHash
          : null;

        const entry = {
          runId: params.p_run_id,
          actor: params.p_actor,
          action: params.p_action,
          state: params.p_state,
          recordedAt: params.p_recorded_at,
          metadata: JSON.parse(params.p_metadata_json || '{}'),
        };

        if ((params.p_previous_hash || null) !== previousHash) {
          return { error: { message: 'previous_hash_conflict' } };
        }
        if (hashEntry(entry, previousHash) !== params.p_integrity_hash) {
          return { error: { message: 'integrity_hash_invalid' } };
        }

        const stored = { ...entry, integrityHash: params.p_integrity_hash };
        entries.push(stored);
        return { data: JSON.parse(JSON.stringify(stored)) };
      }

      if (name === 'orchestration_read_checkpoint') {
        return { data: state.checkpoints.get(params.p_run_id) || null };
      }

      if (name === 'orchestration_write_checkpoint') {
        requireLease(params.p_run_id, params.p_worker_id, params.p_lease_token);
        state.checkpoints.set(
          params.p_run_id,
          JSON.parse(JSON.stringify(params.p_checkpoint))
        );
        return { data: params.p_checkpoint };
      }

      return { error: { message: 'unknown_rpc' } };
    } catch (error) {
      return { error: { message: error.message } };
    }
  }

  return { state, rpc };
}

describe('Phase 9B production governed runtime binding', () => {
  const enabledEnv = {
    TORQUEMIND_ENVIRONMENT: 'production',
    TORQUEMIND_ORCHESTRATION_PERSISTENCE: 'supabase',
    TORQUEMIND_ORCHESTRATION_SUPABASE_PROJECT_REF: 'pffdgqpynpbffbcnxmum',
    SUPABASE_URL: 'https://pffdgqpynpbffbcnxmum.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'server-only-placeholder',
  };

  test('disabled persistence preserves the legacy synchronous orchestrator path', () => {
    const createClientImpl = jest.fn();
    const runtime = createProductionAIOrchestrator({
      env: {
        TORQUEMIND_ENVIRONMENT: 'preview',
        TORQUEMIND_ORCHESTRATION_PERSISTENCE: 'disabled',
      },
      workerId: 'preview-worker',
      createClientImpl,
    });

    expect(runtime.persistence.enabled).toBe(false);
    expect(createClientImpl).not.toHaveBeenCalled();

    runtime.orchestrator.registerAgent({
      id: 'legacy-agent',
      capabilities: ['legacy-work'],
      execute: async () => ({ done: true }),
    });

    expect(() => runtime.orchestrator.submit({
      id: 'legacy-preview',
      capability: 'legacy-work',
    })).not.toThrow();
  });

  test('native draft initialization creates only the drafted state on an empty run', async () => {
    const backend = createBackend();
    const runtime = createProductionAIOrchestrator({
      env: enabledEnv,
      workerId: 'draft-initializer',
      createClientImpl: () => ({ rpc: backend.rpc }),
    });

    const first = await runtime.governanceRuntime.initializeDraft({
      runId: 'native-draft-run',
      provenanceId: 'prov-draft-1',
      questionId: 'charging-system-native-draft-01',
      createdAt: '2026-10-06T03:00:00.000Z',
    });

    expect(first).toMatchObject({
      actor: 'question-agent',
      action: 'draft-initialized',
      state: 'drafted',
      metadata: expect.objectContaining({
        provenanceId: 'prov-draft-1',
        questionId: 'charging-system-native-draft-01',
        initialState: true,
        humanApproval: false,
      }),
    });

    const entries = backend.state.entries.get('native-draft-run');
    expect(entries).toHaveLength(1);
    expect(backend.state.checkpoints.get('native-draft-run')).toMatchObject({
      version: 1,
      state: 'drafted',
      action: 'draft-initialized',
      status: 'draft-initialized',
      integrityHash: entries[0].integrityHash,
    });
    expect(backend.state.leases.size).toBe(0);

    const duplicate = await runtime.governanceRuntime.initializeDraft({
      runId: 'native-draft-run',
      provenanceId: 'prov-draft-1',
      questionId: 'charging-system-native-draft-01',
      createdAt: '2026-10-06T03:00:00.000Z',
    });
    expect(duplicate.integrityHash).toBe(first.integrityHash);
    expect(backend.state.entries.get('native-draft-run')).toHaveLength(1);
  });

  test('native draft initialization fails closed for nonempty runs or non-question actors', async () => {
    const backend = createBackend();
    const runtime = createProductionAIOrchestrator({
      env: enabledEnv,
      workerId: 'draft-initializer',
      createClientImpl: () => ({ rpc: backend.rpc }),
    });

    await runtime.persistence.coordinator.append({
      runId: 'occupied-run',
      actor: 'question-agent',
      action: 'draft-initialized',
      state: 'drafted',
      metadata: { questionId: 'other', provenanceId: 'other-prov' },
    });

    await expect(runtime.governanceRuntime.initializeDraft({
      runId: 'occupied-run',
      provenanceId: 'prov-draft-2',
      questionId: 'charging-system-native-draft-02',
      createdAt: '2026-10-06T03:00:00.000Z',
    })).rejects.toThrow(/requires an empty governed run/);

    await expect(runtime.governanceRuntime.initializeDraft({
      runId: 'wrong-actor-run',
      actor: 'human',
      provenanceId: 'prov-draft-3',
      questionId: 'charging-system-native-draft-03',
      createdAt: '2026-10-06T03:00:00.000Z',
    })).rejects.toThrow(/actor is not permitted/);

    expect(backend.state.entries.get('wrong-actor-run') || []).toHaveLength(0);
  });

  test('production persistent submission writes start, finish, and recovery checkpoint through Supabase RPC', async () => {
    const backend = createBackend();
    const createClientImpl = jest.fn(() => ({ rpc: backend.rpc }));

    const runtime = createProductionAIOrchestrator({
      env: enabledEnv,
      workerId: 'production-worker',
      createClientImpl,
    });

    await runtime.persistence.coordinator.append({
      runId: 'persistent-run',
      actor: 'human',
      action: 'human-approval-recorded',
      state: 'final_content_approved',
      metadata: {
        approvalEvidence: 'preexisting-human-approval',
        reviewerIdentity: 'reviewer-123',
      },
    });

    runtime.orchestrator.registerAgent({
      id: 'question-agent',
      capabilities: ['question-drafting'],
      execute: async () => ({ itemId: 'item-persisted' }),
    });

    await runtime.orchestrator.submitPersistentGoverned({
      id: 'persistent-request',
      capability: 'question-drafting',
      governed: {
        runId: 'persistent-run',
        from: 'final_content_approved',
        to: 'item_generated',
      },
    });

    expect(backend.state.entries.get('persistent-run')).toHaveLength(2);
    expect(backend.state.entries.get('persistent-run')[1]).toMatchObject({
      action: 'step-started',
      state: 'final_content_approved',
    });

    await runtime.orchestrator.drain();

    const entries = backend.state.entries.get('persistent-run');
    expect(entries).toHaveLength(3);
    expect(entries[2]).toMatchObject({
      action: 'step-finished',
      state: 'item_generated',
    });

    expect(backend.state.checkpoints.get('persistent-run')).toMatchObject({
      version: 3,
      state: 'item_generated',
      status: 'step-completed',
      integrityHash: entries[2].integrityHash,
    });
    expect(backend.state.leases.size).toBe(0);
  });

  test('persistent production path requires a pre-existing governed run state', async () => {
    const backend = createBackend();
    const runtime = createProductionAIOrchestrator({
      env: enabledEnv,
      workerId: 'production-worker',
      createClientImpl: () => ({ rpc: backend.rpc }),
    });

    runtime.orchestrator.registerAgent({
      id: 'question-agent',
      capabilities: ['question-drafting'],
      execute: async () => ({ done: true }),
    });

    await expect(runtime.orchestrator.submitPersistentGoverned({
      capability: 'question-drafting',
      governed: {
        runId: 'missing-prior-state',
        from: 'final_content_approved',
        to: 'item_generated',
      },
    })).rejects.toThrow(/requires prior governance state/);

    expect(backend.state.entries.get('missing-prior-state') || []).toHaveLength(0);
  });

  test('persistent human approval remains a separate explicit control plane', async () => {
    const backend = createBackend();
    const runtime = createProductionAIOrchestrator({
      env: enabledEnv,
      workerId: 'production-worker',
      createClientImpl: () => ({ rpc: backend.rpc }),
    });

    await runtime.persistence.coordinator.append({
      runId: 'approval-run',
      actor: 'instructional-review-agent',
      action: 'step-finished',
      state: 'instructionally_reviewed',
      metadata: { requestId: 'instructional-review-request' },
    });

    const humanGate = new HumanGateController({
      governanceRuntime: runtime.governanceRuntime,
    });

    await humanGate.recordApproval({
      runId: 'approval-run',
      from: 'instructionally_reviewed',
      to: 'final_content_approved',
      reviewerIdentity: 'reviewer-123',
      reviewedAt: '2026-10-05T04:30:00.000Z',
      approvalEvidence: 'approval-evidence-123',
    });

    const entries = backend.state.entries.get('approval-run');
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({
      actor: 'human',
      action: 'human-approval-recorded',
      state: 'final_content_approved',
      metadata: expect.objectContaining({
        approvalEvidence: 'approval-evidence-123',
      }),
    });
  });

  test('persistent production path still rejects a human-only transition', async () => {
    const backend = createBackend();
    const runtime = createProductionAIOrchestrator({
      env: enabledEnv,
      workerId: 'production-worker',
      createClientImpl: () => ({ rpc: backend.rpc }),
    });

    await runtime.persistence.coordinator.append({
      runId: 'human-gate-run',
      actor: 'instructional-review-agent',
      action: 'step-finished',
      state: 'instructionally_reviewed',
      metadata: { requestId: 'instructional-review-request' },
    });

    runtime.orchestrator.registerAgent({
      id: 'instructional-review-agent',
      capabilities: ['instructional-review-preparation'],
      execute: async () => ({ done: true }),
    });

    await expect(runtime.orchestrator.submitPersistentGoverned({
      capability: 'instructional-review-preparation',
      governed: {
        runId: 'human-gate-run',
        from: 'instructionally_reviewed',
        to: 'final_content_approved',
      },
    })).rejects.toThrow(/Governed transition denied/);

    expect(backend.state.entries.get('human-gate-run') || []).toHaveLength(1);
  });
});
