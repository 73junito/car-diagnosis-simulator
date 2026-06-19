// examples/observability-playground.js
// Demonstrates streaming `onEvent`, `onAttempt`, and `onFinal` with aggregated metrics.

const { Job, runJob } = require('../lib/worker');
const { runPipeline } = require('../scripts/auto-open-regression-issues');

async function demoReal(owner, repo, token) {
  const job = new Job({ id: `observ-${Date.now().toString(36)}`, type: 'OBSERV' , input: { owner, repo, token } });
  const events = [];

  const res = await runJob(job, {
    onEvent(evt) {
      // worker augments jobId into events already; print concise output
      console.log('[event]', evt.type, evt.payload || evt);
      events.push(evt);
    },
    async onAttempt(j, info) {
      console.log('[attempt] attempt=', info.attempt);
    },
    async onFinal(j, summary) {
      console.log('[final]', summary);
    },
    // handler.run signature: (owner, repo, token, ctx)
    async run(ownerArg, repoArg, tokenArg, ctx) {
      // pass context.onEvent through to runPipeline so it can emit events
      return runPipeline(ownerArg, repoArg, tokenArg, { onEvent: ctx.onEvent, jobId: ctx.jobId });
    }
  });

  console.log('\n=== playground result ===');
  console.log(JSON.stringify({ status: res.status, attempts: res.attempt, metrics: res.result && res.result.processedArtifacts !== undefined ? {
    processedArtifacts: res.result.processedArtifacts,
    skippedArtifacts: res.result.skippedArtifacts,
    skippedReasons: res.result.skippedReasons,
    artifactHashes: res.result.artifactHashes
  } : null }, null, 2));
}

async function demoSimulated() {
  console.log('No GITHUB_REPOSITORY/GITHUB_TOKEN found — running simulated demo.');
  const job = new Job({ id: `observ-sim-${Date.now().toString(36)}`, type: 'OBSERV-SIM', input: {} });
  const events = [];

  const res = await runJob(job, {
    onEvent(evt) {
      console.log('[event]', evt.type, evt);
      events.push(evt);
    },
    onAttempt(j, info) {
      console.log('[attempt]', info.attempt);
    },
    onFinal(j, summary) {
      console.log('[final]', summary);
    },
    async run() {
      // emit a few synthetic events similar to the real pipeline
      if (typeof this.onEvent === 'function') {
        try { this.onEvent({ type: 'request.start', payload: { method: 'GET', url: 'https://api.github.com/repos/x/y/actions/artifacts' } }); } catch (_) {}
        try { this.onEvent({ type: 'request.success', payload: { status: 200 } }); } catch (_) {}
        try { this.onEvent({ type: 'artifact.skipped', payload: { artifactId: 401, reason: 'duplicate' } }); } catch (_) {}
      }
      // return a result shaped like runPipeline
      return {
        candidates: [{ name: 'DemoTest — simulated', occurrences: 2 }],
        results: [],
        artifactHashes: [],
        processedArtifacts: 5,
        skippedArtifacts: 1,
        skippedReasons: { duplicate: 1 }
      };
    }
  });

  console.log('\n=== simulated playground result ===');
  console.log(JSON.stringify({ status: res.status, attempts: res.attempt, metrics: res.result && res.result.processedArtifacts !== undefined ? {
    processedArtifacts: res.result.processedArtifacts,
    skippedArtifacts: res.result.skippedArtifacts,
    skippedReasons: res.result.skippedReasons,
    artifactHashes: res.result.artifactHashes
  } : null }, null, 2));
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (repo && token) {
    const [owner, repoName] = repo.split('/');
    await demoReal(owner, repoName, token);
  } else {
    await demoSimulated();
  }
}

if (require.main === module) main().catch(err=>{ console.error(err); process.exit(1); });
