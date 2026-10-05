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

function lengthPrefix(value) {
  const text = String(value ?? '');
  return `${Buffer.byteLength(text, 'utf8')}:${text}`;
}

function buildHashMaterial(entry, previousHash = null) {
  const metadataJson = JSON.stringify(canonicalize(entry.metadata || {}));

  return [
    previousHash || '',
    entry.runId,
    entry.actor,
    entry.action,
    entry.state,
    entry.recordedAt,
    metadataJson,
  ]
    .map(lengthPrefix)
    .join('|');
}

function hashEntry(entry, previousHash = null) {
  return crypto
    .createHash('sha256')
    .update(buildHashMaterial(entry, previousHash), 'utf8')
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
  lengthPrefix,
  buildHashMaterial,
  hashEntry,
  verifyChain,
};
