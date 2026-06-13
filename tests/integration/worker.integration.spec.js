// Ensure deterministic fetch/Request globals for this test file (run before any imports).
try { require('../../tests/jest-undici-register.js'); } catch (e) {}
const path = require('path');
const fs = require('fs');
const createFetchMock = require('../utils/createFetchMock');
const { Job, InMemoryQueue, runAll } = require('../../lib/worker');
const mod = require(path.resolve(process.cwd(), 'scripts', 'auto-open-regression-issues.js'));

describe('worker integration', () => {
  let mock;
  afterEach(() => {
    try { if (mock && mock.restore) mock.restore(); } catch (e) {}
  });

  test('job executes end-to-end and returns candidates', async () => {
    const owner = '73junito';
    const repo = 'car-diagnosis-simulator';

    const slowJson = { slow: [{ classname: 'TestClass', name: 'workerIntegration' }] };
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const buf = zip.toBuffer();

    const closedIssue = { number: 500, title: 'irrelevant', state: 'closed', closed_at: null, body: 'Existing body\n<!-- flap_count: 0 -->' };
    const mockSetup = createFetchMock({ artifactId: 900, zipBuffer: buf, closedIssue });
    const installed = mockSetup.install();
    mock = Object.assign(mockSetup, installed);

    // ensure no persistent artifact checkpoint from other tests blocks this run
    try {
      const checkpoint = require('../../core/checkpoint');
      const crypto = require('crypto');
      const h = crypto.createHash('sha256').update(buf).digest('hex');
      await checkpoint.delete(`artifact:${h}`);
    } catch (e) {
      // ignore
    }

    // run the job via the worker using the real pipeline
    process.env.ISSUE_MIN_OCCURRENCES = '1';
    const queue = new InMemoryQueue();
    const job = new Job({ id: 'job-1', type: 'AUTO_OPEN_ISSUES', input: { owner, repo, token: 't' } });
    queue.enqueue(job);

    const results = await runAll(queue, { run: mod.runPipeline });
    expect(results.length).toBe(1);
    const out = results[0];
    expect(out.status).toBe('success');
    expect(out.result).toBeTruthy();
    expect(Array.isArray(out.result.candidates)).toBe(true);
    expect(out.result.candidates.length).toBeGreaterThanOrEqual(1);
    console.log('DEBUG out.result:', JSON.stringify(out.result));

    // network calls were exercised as part of the pipeline; results validated above
  });
});
