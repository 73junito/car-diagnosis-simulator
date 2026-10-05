'use strict';

const crypto = require('crypto');

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (typeof value[key] !== 'undefined') {
          result[key] = canonicalize(value[key]);
        }
        return result;
      }, {});
  }

  return value;
}

function hashEntry(entry, previousHash = null) {
  const payload = {
    previousHash: previousHash || null,
    entry: canonicalize({
      runId: entry.runId,
      actor: entry.actor,
      action: entry.action,
      state: entry.state,
      recordedAt: entry.recordedAt,
      metadata: entry.metadata || {},
    }),
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function verifyChain(entries) {
  let previousHash = null;

  for (const entry of entries) {
    const expected = hashEntry(entry, previousHash);
    if (!entry.integrityHash || entry.integrityHash !== expected) {
      return {
        valid: false,
        reason: 'Integrity chain mismatch',
        entry,
      };
    }
    previousHash = entry.integrityHash;
  }

  return {
    valid: true,
    previousHash,
  };
}

module.exports = {
  canonicalize,
  hashEntry,
  verifyChain,
};
