'use strict';

class RunLedger {
  constructor({ store = null } = {}) {
    this.store = store;
    this.entries = store ? store.loadEntries().map((entry) => this.freezeEntry(entry)) : [];
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

    const normalized = this.freezeEntry({
      ...entry,
      recordedAt: entry.recordedAt || new Date().toISOString(),
    });

    if (this.store) {
      this.store.appendEntry({
        ...normalized,
        metadata: { ...normalized.metadata },
      });
    }

    this.entries.push(normalized);
    return normalized;
  }

  freezeEntry(entry) {
    return Object.freeze({
      ...entry,
      metadata: Object.freeze({ ...(entry.metadata || {}) }),
    });
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
