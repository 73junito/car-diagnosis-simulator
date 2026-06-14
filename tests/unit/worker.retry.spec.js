const { Job, InMemoryQueue, runJob } = require('../../lib/worker');

describe('worker retry behavior', () => {
  test('retries transient failures and succeeds before maxAttempts', async () => {
    const checkpoint = require('../../core/checkpoint');
    // clear any persisted checkpoints for deterministic test runs
    await checkpoint.delete('job:retry-job-1').catch(()=>{});
    await checkpoint.delete('job:retry-job-1:final').catch(()=>{});
    await checkpoint.delete('job:retry-job-1:attempts').catch(()=>{});
    let calls = 0;
    const handler = async (owner, repo, token) => {
      calls += 1;
      if (calls < 3) {
        throw new Error('transient');
      }
      return { ok: true, processed: true };
    };

    const job = new Job({ id: 'retry-job-1', type: 'TEST', input: { owner: 'o', repo: 'r', token: 't' } });
    job.maxAttempts = 5;
    job.retryBaseMs = 10; // keep backoff short for tests
    const attempts = [];
    const finals = [];
    const onAttempt = async (j, info) => { attempts.push(info); };
    const onFinal = async (j, info) => { finals.push(info); };

    const res = await runJob(job, { run: handler, onAttempt, onFinal });
    expect(res.status).toBe('success');
    expect(res.attempt).toBeGreaterThanOrEqual(3);
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(attempts.length).toBeGreaterThanOrEqual(3);
    expect(finals.length).toBe(1);
    expect(finals[0].status).toBe('success');
  });

  test('fails permanently after maxAttempts exhausted', async () => {
    const checkpoint = require('../../core/checkpoint');
    await checkpoint.delete('job:retry-job-2').catch(()=>{});
    await checkpoint.delete('job:retry-job-2:final').catch(()=>{});
    await checkpoint.delete('job:retry-job-2:attempts').catch(()=>{});
    let calls = 0;
    const handler = async () => {
      calls += 1;
      throw new Error('always-fail');
    };
    const job = new Job({ id: 'retry-job-2', type: 'TEST', input: { owner: 'o', repo: 'r', token: 't' } });
    job.maxAttempts = 2;
    job.retryBaseMs = 10;
    const attempts = [];
    const finals = [];
    const onAttempt = (j, info) => { attempts.push(info); };
    const onFinal = (j, info) => { finals.push(info); };

    const res = await runJob(job, { run: handler, onAttempt, onFinal });
    expect(res.status).toBe('failed');
    expect(res.attempt).toBe(2);
    expect(calls).toBe(2);
    expect(attempts.length).toBe(2);
    expect(finals.length).toBe(1);
    expect(finals[0].status).toBe('failed');
  });
});
