const crypto = require('crypto');

// Deterministic JSON serializer: sorts object keys recursively and
// serializes Buffers/ArrayBuffers and Dates in a stable way. Use this
// for job/artifact fingerprinting to avoid nondeterminism from
// unordered object key iteration.
function stableStringify(value) {
  const seen = new WeakSet();
  function _serialize(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Buffer.isBuffer(v)) return JSON.stringify({ __type: 'Buffer', data: v.toString('hex') });
    if (v instanceof ArrayBuffer) return JSON.stringify({ __type: 'ArrayBuffer', data: Buffer.from(v).toString('hex') });
    if (v instanceof Date) return JSON.stringify({ __type: 'Date', data: v.toISOString() });
    if (seen.has(v)) return JSON.stringify('[Circular]');
    seen.add(v);
    if (Array.isArray(v)) {
      return '[' + v.map(_serialize).join(',') + ']';
    }
    // plain object: sort keys
    const keys = Object.keys(v).sort();
    const parts = keys.map(k => JSON.stringify(k) + ':' + _serialize(v[k]));
    return '{' + parts.join(',') + '}';
  }
  return _serialize(value);
}

class Job {
  constructor({ id, type, input }) {
    this.id = id || `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(36)}`;
    this.type = type || 'JOB';
    this.input = input || {};
    this.status = 'pending';
    this.startedAt = null;
    this.finishedAt = null;
    this.result = null;
    this.error = null;
  }
}

function _fingerprintJob(job) {
  const payload = stableStringify({ type: job.type, input: job.input });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function _sanitizeJobForCheckpoint(job) {
  try {
    const copy = Object.assign({}, job);
    if (copy && copy.input && typeof copy.input === 'object') {
      copy.input = Object.assign({}, copy.input);
      if (typeof copy.input.token === 'string') copy.input.token = '[REDACTED]';
    }
    return copy;
  } catch (e) {
    return job; // best-effort
  }
}

// Default checkpoint store is pluggable; require it lazily to avoid boot-time issues
let checkpointStore;
try {
  checkpointStore = require('../core/checkpoint');
} catch (e) {
  checkpointStore = null;
}

// in-memory cache fallback when no persistent store available
const seenJobs = new Map();

class InMemoryQueue {
  constructor() {
    this._q = [];
  }
  enqueue(job) {
    this._q.push(job);
    return job;
  }
  dequeue() {
    return this._q.shift();
  }
  isEmpty() { return this._q.length === 0; }
}

async function runJob(job, handlers = {}) {
  if (!job || typeof job !== 'object') throw new Error('job required');
  // compute a deterministic key for idempotency
  const key = job.id || _fingerprintJob(job);
  // augment job with attempt tracking defaults
  job.attempt = Number(job.attempt || 0);
  job.maxAttempts = Number(job.maxAttempts || process.env.WORKER_MAX_ATTEMPTS || 3);

  // If a checkpoint store is available, consult it first for idempotency
  if (checkpointStore) {
    try {
      const finalKey = `job:${key}:final`;
      if (await checkpointStore.has(finalKey)) {
        return await checkpointStore.get(finalKey);
      }
    } catch (e) {
      // fallback to in-memory behavior
    }
  } else {
    // If we've already seen this job in-memory, return the stored job/result
    if (seenJobs.has(key)) return seenJobs.get(key);
  }

  // Retry loop owned by worker
  while (job.attempt < job.maxAttempts) {
    job.attempt += 1;
    job.status = job.attempt === 1 ? 'running' : 'retrying';
    job.startedAt = job.startedAt || new Date().toISOString();
    // store early so concurrent duplicates observe 'running' state and avoid duplicate execution
    seenJobs.set(key, job);
    if (checkpointStore) {
      try { await checkpointStore.set(`job:${key}:attempts`, { attempt: job.attempt, status: job.status, ts: Date.now() }); } catch (e) {}
      try { await checkpointStore.set(`job:${key}`, _sanitizeJobForCheckpoint(job)); } catch (e) {}
    }

    try {
      // handlers.run is expected to be an async function that performs the pipeline
      if (typeof handlers.run !== 'function') throw new Error('handlers.run must be a function');
      // invoke onAttempt hook if provided
      try {
        if (typeof handlers.onAttempt === 'function') {
          // provide lightweight snapshot for observers
          const attemptInfo = { attempt: job.attempt, maxAttempts: job.maxAttempts, status: job.status, ts: Date.now() };
          // allow onAttempt to be sync or async
          await handlers.onAttempt(job, attemptInfo);
        }
      } catch (hookErr) {
        // don't fail job because observer hook failed
        try { console.error('onAttempt hook error', hookErr && hookErr.message); } catch (e) {}
      }
      // pass onEvent context explicitly to the pipeline
      const res = await handlers.run(job.input.owner, job.input.repo, job.input.token, { onEvent: typeof handlers.onEvent === 'function' ? handlers.onEvent : undefined, jobId: key });
      job.result = res;
      job.status = 'success';
      job.finishedAt = new Date().toISOString();
      // onFinal hook for success — include aggregated metrics when available
      try {
        if (typeof handlers.onFinal === 'function') {
          const durationMs = job.startedAt ? (Date.parse(job.finishedAt) - Date.parse(job.startedAt)) : undefined;
          const metrics = (job.result && typeof job.result === 'object') ? {
            processedArtifacts: job.result.processedArtifacts || 0,
            skippedArtifacts: job.result.skippedArtifacts || 0,
            skippedReasons: job.result.skippedReasons || {},
            artifactHashes: job.result.artifactHashes || []
          } : undefined;
          const resultInfo = { status: job.status, attempts: job.attempt, finishedAt: job.finishedAt, durationMs, metrics };
          await handlers.onFinal(job, resultInfo);
        }
      } catch (hookErr) {
        try { console.error('onFinal hook error', hookErr && hookErr.message); } catch (e) {}
      }
      // persist final job state
      seenJobs.set(key, job);
      if (checkpointStore) {
        try { await checkpointStore.set(`job:${key}`, _sanitizeJobForCheckpoint(job)); } catch (e) {}
        try { await checkpointStore.set(`job:${key}:final`, _sanitizeJobForCheckpoint(job)); } catch (e) {}
      }
      return job;
    } catch (err) {
      job.error = err && (err.message || String(err));
      job.status = 'failed';
      job.finishedAt = new Date().toISOString();
      // persist failure snapshot
      seenJobs.set(key, job);
      if (checkpointStore) {
        try { await checkpointStore.set(`job:${key}`, _sanitizeJobForCheckpoint(job)); } catch (e) {}
      }
      // if this is terminal (no more attempts) call onFinal hook with failure
      // decide whether to retry
      if (job.attempt >= job.maxAttempts) {
        try {
          if (typeof handlers.onFinal === 'function') {
            const durationMs = job.startedAt ? (Date.parse(job.finishedAt) - Date.parse(job.startedAt)) : undefined;
            const metrics = (job.result && typeof job.result === 'object') ? {
              processedArtifacts: job.result.processedArtifacts || 0,
              skippedArtifacts: job.result.skippedArtifacts || 0,
              skippedReasons: job.result.skippedReasons || {},
              artifactHashes: job.result.artifactHashes || []
            } : undefined;
            const resultInfo = { status: job.status, attempts: job.attempt, error: job.error, finishedAt: job.finishedAt, durationMs, metrics };
            await handlers.onFinal(job, resultInfo);
          }
        } catch (hookErr) {
          try { console.error('onFinal hook error', hookErr && hookErr.message); } catch (e) {}
        }
        // mark final failure
        if (checkpointStore) {
          try { await checkpointStore.set(`job:${key}:final`, _sanitizeJobForCheckpoint(job)); } catch (e) {}
        }
        return job;
      }
      // backoff before next attempt
      const base = Number(job.retryBaseMs || process.env.WORKER_RETRY_BASE_MS || 1000);
      const jitter = Math.floor(Math.random() * 1000);
      const delay = Math.round(base * Math.pow(2, job.attempt - 1)) + jitter;
      await new Promise(r => setTimeout(r, delay));
      // continue loop to retry
    }
  }
  // if we exit loop unexpectedly, return job (shouldn't normally reach here)
  return job;
}

async function runAll(queue, handlers) {
  const results = [];
  while (!queue.isEmpty()) {
    const job = queue.dequeue();
    // run sequentially for simplicity
    const r = await runJob(job, handlers);
    results.push(r);
  }
  return results;
}

module.exports = { Job, InMemoryQueue, runJob, runAll };
