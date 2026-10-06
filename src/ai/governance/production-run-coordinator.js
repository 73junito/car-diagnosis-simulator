'use strict';

const { verifyChain } = require('./integrity-chain');

class ProductionRunCoordinator {
  constructor({ store } = {}) {
    if (!store) throw new Error('ProductionRunCoordinator requires store');
    this.store = store;
  }

  async withLease(runId, callback) {
    const lease = await this.store.acquireLease(runId);
    if (!lease || !lease.lease_token) {
      throw new Error('Run lease acquisition failed');
    }

    try {
      return await callback(lease.lease_token);
    } finally {
      await this.store.releaseLease(runId, lease.lease_token);
    }
  }

  async append(entry) {
    return this.withLease(entry.runId, async (leaseToken) => {
      const entries = await this.store.loadEntries(entry.runId);
      const chain = verifyChain(entries);
      if (!chain.valid) {
        throw new Error(chain.reason);
      }

      const recordedAt = entry.recordedAt || new Date().toISOString();
      return this.store.appendEntry(
        { ...entry, recordedAt },
        {
          leaseToken,
          expectedVersion: entries.length,
          previousHash: chain.previousHash || null,
        }
      );
    });
  }

  async recover(runId) {
    return this.withLease(runId, async (leaseToken) => {
      const entries = await this.store.loadEntries(runId);
      const chain = verifyChain(entries);
      if (!chain.valid) {
        throw new Error(chain.reason);
      }
      if (!entries.length) return null;

      const latest = entries[entries.length - 1];
      const statusByAction = {
        'draft-initialized': 'draft-initialized',
        'evidence-mapping-recorded': 'evidence-mapped',
        'rights-review-recorded': 'rights-reviewed',
        'technical-review-recorded': 'technically-reviewed',
        'step-started': 'interrupted',
        'step-finished': 'step-completed',
        'handoff-recorded': 'awaiting-handoff',
        'human-approval-recorded': 'human-approved',
      };
      const recovery = {
        runId,
        state: latest.state,
        action: latest.action,
        status: statusByAction[latest.action] || 'unknown',
        resumable: statusByAction[latest.action] ? true : false,
        version: entries.length,
        integrityHash: latest.integrityHash,
        metadata: { ...(latest.metadata || {}) },
      };

      const checkpoint = await this.store.readCheckpoint(runId);
      if (
        !checkpoint ||
        checkpoint.version !== recovery.version ||
        checkpoint.integrityHash !== recovery.integrityHash
      ) {
        await this.store.writeCheckpoint(runId, recovery, {
          leaseToken,
          expectedVersion: entries.length,
        });
      }

      return recovery;
    });
  }
}

module.exports = ProductionRunCoordinator;
