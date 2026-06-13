const checkpoint = require('../../core/checkpoint');
const { replayJob } = require('../../scripts/replay-job');
const { Job } = require('../../lib/worker');

describe('replay-job CLI/module', () => {
  test('replays a failed job and updates final state', async () => {
    const id = 'replay-job-1';
    const key = `job:${id}`;
    const job = new Job({ id, type: 'TEST', input: { owner: 'o', repo: 'r', token: 't' } });
    job.attempt = 2;
    job.maxAttempts = 2;
    job.status = 'failed';
    job.error = 'original-failure';

    await checkpoint.set(key, job);
    await checkpoint.set(`${key}:final`, job);

    // replay with a handler that succeeds
    const handler = async () => ({ ok: true, replayed: true });
    const res = await replayJob(id, { runHandler: handler, force: true });
    expect(res.skipped).toBe(false);
    expect(res.result).toBeTruthy();
    expect(res.result.status).toBe('success');

    const final = await checkpoint.get(`${key}:final`);
    expect(final).toBeTruthy();
    expect(final.status).toBe('success');
  });
});
