const SupabaseRunStore = require('../src/ai/governance/supabase-run-store');
const ProductionRunCoordinator = require('../src/ai/governance/production-run-coordinator');
const { hashEntry } = require('../src/ai/governance/integrity-chain');
const contract = require('../data/architecture/agent-orchestration-production-persistence-contract.json');

function createBackend() {
  const state = {
    entries: new Map(),
    checkpoints: new Map(),
    leases: new Map(),
    leaseCounter: 0,
  };

  function getEntries(runId) {
    if (!state.entries.has(runId)) state.entries.set(runId, []);
    return state.entries.get(runId);
  }

  function activeLease(runId) {
    return state.leases.get(runId) || null;
  }

  function requireLease(runId, workerId, token) {
    const lease = activeLease(runId);
    if (!lease || lease.workerId !== workerId || lease.token !== token) {
      throw new Error('lease_not_owned');
    }
    return lease;
  }

  async function rpc(name, params) {
    try {
      switch (name) {
        case 'orchestration_load_entries':
          return { data: JSON.parse(JSON.stringify(getEntries(params.p_run_id))) };

        case 'orchestration_acquire_lease': {
          const current = activeLease(params.p_run_id);
          if (current && current.workerId !== params.p_worker_id) {
            return { error: { message: 'lease_conflict' } };
          }
          const token = current
            ? current.token
            : `lease-${++state.leaseCounter}`;
          state.leases.set(params.p_run_id, {
            workerId: params.p_worker_id,
            token,
          });
          return { data: { lease_token: token } };
        }

        case 'orchestration_release_lease':
          requireLease(
            params.p_run_id,
            params.p_worker_id,
            params.p_lease_token
          );
          state.leases.delete(params.p_run_id);
          return { data: { released: true } };

        case 'orchestration_append_entry': {
          requireLease(
            params.p_run_id,
            params.p_worker_id,
            params.p_lease_token
          );

          const entries = getEntries(params.p_run_id);
          if (params.p_expected_version !== entries.length) {
            return { error: { message: 'version_conflict' } };
          }

          const previousHash = entries.length
            ? entries[entries.length - 1].integrityHash
            : null;

          if ((params.p_previous_hash || null) !== previousHash) {
            return { error: { message: 'previous_hash_conflict' } };
          }

          const entry = {
            runId: params.p_run_id,
            actor: params.p_actor,
            action: params.p_action,
            state: params.p_state,
            recordedAt: params.p_recorded_at,
            metadata: params.p_metadata || {},
          };

          if (hashEntry(entry, previousHash) !== params.p_integrity_hash) {
            return { error: { message: 'integrity_hash_invalid' } };
          }

          const stored = {
            ...entry,
            integrityHash: params.p_integrity_hash,
          };
          entries.push(stored);
          return { data: JSON.parse(JSON.stringify(stored)) };
        }

        case 'orchestration_read_checkpoint':
          return {
            data: state.checkpoints.get(params.p_run_id) || null,
          };

        case 'orchestration_write_checkpoint':
          requireLease(
            params.p_run_id,
            params.p_worker_id,
            params.p_lease_token
          );
          if (
            params.p_expected_version !== getEntries(params.p_run_id).length
          ) {
            return { error: { message: 'checkpoint_version_conflict' } };
          }
          state.checkpoints.set(
            params.p_run_id,
            JSON.parse(JSON.stringify(params.p_checkpoint))
          );
          return { data: params.p_checkpoint };

        default:
          return { error: { message: 'unknown_rpc' } };
      }
    } catch (error) {
      return { error: { message: error.message } };
    }
  }

  return { state, rpc };
}

describe('Phase 5 production persistence adapter', () => {
  test('contract is private, lease-guarded, CAS protected, and not deployed', () => {
    expect(contract.storage_target).toBe('supabase-postgres');
    expect(contract.deployment_status).toBe('contract-only-not-applied');
    expect(contract.access_model.service_role_only).toBe(true);
    expect(contract.access_model.anon_access).toBe(false);
    expect(contract.access_model.authenticated_access).toBe(false);
    expect(contract.concurrency.lease_required_for_mutation).toBe(true);
    expect(contract.concurrency.compare_and_swap_version).toBe(true);
    expect(contract.integrity.append_only_hash_chain).toBe(true);
  });

  test('appends and recovers through the Supabase RPC adapter', async () => {
    const backend = createBackend();
    const store = new SupabaseRunStore({
      rpc: backend.rpc,
      workerId: 'worker-a',
    });
    const coordinator = new ProductionRunCoordinator({ store });

    await coordinator.append({
      runId: 'run-a',
      actor: 'question-agent',
      action: 'step-started',
      state: 'final_content_approved',
      metadata: { requestId: 'request-a' },
    });

    await coordinator.append({
      runId: 'run-a',
      actor: 'question-agent',
      action: 'step-finished',
      state: 'item_generated',
      metadata: { requestId: 'request-a' },
    });

    const recovery = await coordinator.recover('run-a');

    expect(recovery).toMatchObject({
      runId: 'run-a',
      state: 'item_generated',
      status: 'step-completed',
      version: 2,
      resumable: true,
    });

    expect(backend.state.checkpoints.get('run-a')).toMatchObject({
      version: 2,
      state: 'item_generated',
    });
  });

  test('active lease blocks a competing worker', async () => {
    const backend = createBackend();
    const storeA = new SupabaseRunStore({
      rpc: backend.rpc,
      workerId: 'worker-a',
    });
    const storeB = new SupabaseRunStore({
      rpc: backend.rpc,
      workerId: 'worker-b',
    });
    const coordinatorB = new ProductionRunCoordinator({ store: storeB });

    const leaseA = await storeA.acquireLease('contested-run');

    await expect(
      coordinatorB.append({
        runId: 'contested-run',
        actor: 'question-agent',
        action: 'step-started',
        state: 'final_content_approved',
        metadata: { requestId: 'request-b' },
      })
    ).rejects.toThrow(/lease_conflict/);

    await storeA.releaseLease('contested-run', leaseA.lease_token);
  });

  test('compare-and-swap rejects stale writers', async () => {
    const backend = createBackend();
    const store = new SupabaseRunStore({
      rpc: backend.rpc,
      workerId: 'worker-a',
    });
    const lease = await store.acquireLease('cas-run');

    const first = {
      runId: 'cas-run',
      actor: 'question-agent',
      action: 'step-started',
      state: 'final_content_approved',
      recordedAt: '2026-10-05T04:00:00Z',
      metadata: { requestId: 'cas-1' },
    };

    const stored = await store.appendEntry(first, {
      leaseToken: lease.lease_token,
      expectedVersion: 0,
      previousHash: null,
    });

    await expect(
      store.appendEntry(
        {
          ...first,
          action: 'step-finished',
          state: 'item_generated',
          recordedAt: '2026-10-05T04:00:01Z',
        },
        {
          leaseToken: lease.lease_token,
          expectedVersion: 0,
          previousHash: stored.integrityHash,
        }
      )
    ).rejects.toThrow(/version_conflict/);

    await store.releaseLease('cas-run', lease.lease_token);
  });

  test('recovery fails closed when persisted history is tampered', async () => {
    const backend = createBackend();
    const store = new SupabaseRunStore({
      rpc: backend.rpc,
      workerId: 'worker-a',
    });
    const coordinator = new ProductionRunCoordinator({ store });

    await coordinator.append({
      runId: 'tamper-run',
      actor: 'question-agent',
      action: 'step-started',
      state: 'final_content_approved',
      metadata: { requestId: 'tamper-1' },
    });

    backend.state.entries.get('tamper-run')[0].metadata.requestId = 'altered';

    await expect(coordinator.recover('tamper-run'))
      .rejects.toThrow(/Integrity chain mismatch/);
  });

  test('wrong lease token cannot mutate a run', async () => {
    const backend = createBackend();
    const store = new SupabaseRunStore({
      rpc: backend.rpc,
      workerId: 'worker-a',
    });

    await store.acquireLease('token-run');

    await expect(
      store.appendEntry(
        {
          runId: 'token-run',
          actor: 'question-agent',
          action: 'step-started',
          state: 'final_content_approved',
          recordedAt: '2026-10-05T04:00:00Z',
          metadata: {},
        },
        {
          leaseToken: 'wrong-token',
          expectedVersion: 0,
          previousHash: null,
        }
      )
    ).rejects.toThrow(/lease_not_owned/);
  });
});
