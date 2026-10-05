'use strict';

class RunLedger {
  constructor() {
    this.entries = [];
  }

  append(entry) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('RunLedger.append requires an entry');
    }
    for (const field of ['runId', 'actor', 'action', 'state']) {
      if (!entry[field] || typeof entry[field] !== 'string') {
        throw new Error(`Run ledger entry requires ${field}`);
      }
    }

    const normalized = Object.freeze({
      ...entry,
      recordedAt: entry.recordedAt || new Date().toISOString(),
      metadata: Object.freeze({ ...(entry.metadata || {}) }),
    });
    this.entries.push(normalized);
    return normalized;
  }

  list({ runId = null } = {}) {
    return this.entries.filter((entry) => !runId || entry.runId === runId);
  }

  latest(runId) {
    const entries = this.list({ runId });
    return entries.length ? entries[entries.length - 1] : null;
  }
}

module.exports = RunLedger;
