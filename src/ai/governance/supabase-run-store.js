'use strict';

const { hashEntry } = require('./integrity-chain');

class SupabaseRunStore {
  constructor({ rpc, workerId, leaseMs = 30000 } = {}) {
    if (typeof rpc !== 'function') throw new Error('SupabaseRunStore requires rpc');
    if (!workerId) throw new Error('SupabaseRunStore requires workerId');
    this.rpc = rpc;
    this.workerId = workerId;
    this.leaseMs = leaseMs;
  }

  async call(name, params) {
    const response = await this.rpc(name, params);
    if (response && response.error) {
      throw new Error(response.error.message || String(response.error));
    }
    return response && Object.prototype.hasOwnProperty.call(response, 'data')
      ? response.data
      : response;
  }

  async loadEntries(runId) {
    return (await this.call('orchestration_load_entries', {
      p_run_id: runId,
    })) || [];
  }

  async acquireLease(runId, leaseMs = this.leaseMs) {
    return this.call('orchestration_acquire_lease', {
      p_run_id: runId,
      p_worker_id: this.workerId,
      p_lease_ms: leaseMs,
    });
  }

  async releaseLease(runId, leaseToken) {
    return this.call('orchestration_release_lease', {
      p_run_id: runId,
      p_worker_id: this.workerId,
      p_lease_token: leaseToken,
    });
  }

  async appendEntry(entry, { leaseToken, expectedVersion, previousHash }) {
    const integrityHash = hashEntry(entry, previousHash || null);
    return this.call('orchestration_append_entry', {
      p_run_id: entry.runId,
      p_actor: entry.actor,
      p_action: entry.action,
      p_state: entry.state,
      p_recorded_at: entry.recordedAt,
      p_metadata: entry.metadata || {},
      p_worker_id: this.workerId,
      p_lease_token: leaseToken,
      p_expected_version: expectedVersion,
      p_previous_hash: previousHash || null,
      p_integrity_hash: integrityHash,
    });
  }

  async readCheckpoint(runId) {
    return this.call('orchestration_read_checkpoint', {
      p_run_id: runId,
    });
  }

  async writeCheckpoint(runId, checkpoint, { leaseToken, expectedVersion }) {
    return this.call('orchestration_write_checkpoint', {
      p_run_id: runId,
      p_checkpoint: checkpoint,
      p_worker_id: this.workerId,
      p_lease_token: leaseToken,
      p_expected_version: expectedVersion,
    });
  }
}

module.exports = SupabaseRunStore;
