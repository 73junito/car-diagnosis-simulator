const checkpoint = require('../core/checkpoint');
const { Job, runJob } = require('../lib/worker');

async function replayJob(id, { runHandler, force = false } = {}) {
  if (!id) throw new Error('job id required');
  const jobKey = `job:${id}`;
  const finalKey = `${jobKey}:final`;

  const exists = await checkpoint.has(jobKey);
  if (!exists) throw new Error(`No job checkpoint found for ${jobKey}`);

  if (!force && await checkpoint.has(finalKey)) {
    return { skipped: true, reason: 'already_final', job: await checkpoint.get(finalKey) };
  }

  // remove final snapshot to allow re-execution
  try { await checkpoint.delete(finalKey); } catch (e) {}

  const stored = await checkpoint.get(jobKey);
  const jobObj = new Job({ id: stored.id, type: stored.type, input: stored.input });
  // reset attempts so replay starts fresh
  jobObj.attempt = 0;
  jobObj.maxAttempts = Number(stored.maxAttempts || stored.maxAttempts || process.env.WORKER_MAX_ATTEMPTS || 3);
  jobObj.retryBaseMs = stored.retryBaseMs || stored.retryBaseMs;
  jobObj.status = 'pending';
  jobObj.startedAt = null;
  jobObj.finishedAt = null;
  jobObj.result = null;
  jobObj.error = null;

  const result = await runJob(jobObj, { run: runHandler });
  return { skipped: false, result };
}

if (require.main === module) {
  (async ()=>{
    const argv = process.argv.slice(2);
    const id = argv[0];
    const force = argv.includes('--force');
    if (!id) {
      console.error('Usage: node scripts/replay-job.js <jobId> [--force]');
      process.exit(2);
    }
    try {
      // When invoked from CLI, we cannot re-run the original pipeline safely
      // So we just print attempt history and indicate how to programmatically replay.
      const jobKey = `job:${id}`;
      const job = await checkpoint.get(jobKey);
      console.log('Job checkpoint:', jobKey, job || '(missing)');
      const attempts = await checkpoint.get(`${jobKey}:attempts`);
      console.log('Attempts snapshot:', attempts || '(none)');
      if (!force) {
        if (await checkpoint.has(`${jobKey}:final`)) {
          console.log('Job already has a final snapshot. Use --force to replay.');
          process.exit(0);
        }
      }
      console.log('To replay programmatically, require this module and call replayJob(id, { runHandler })');
      process.exit(0);
    } catch (e) {
      console.error('Replay failed', e && e.message);
      process.exit(1);
    }
  })();
}

module.exports = { replayJob };
