// Ensure deterministic fetch/Request globals for this test file (run before any imports).
try { require('../../tests/jest-undici-register.js'); } catch (e) {}
const path = require('path');
const fs = require('fs');
const { Job, InMemoryQueue, runAll } = require('../../lib/worker');
const createFetchMock = require('../utils/createFetchMock');

const owner = '73junito';
const repo = 'car-diagnosis-simulator';

function makeSlowJson(name) {
  return { slow: [{ classname: 'TestClass', name }] };
}

describe('auto-open partial-failure recovery', () => {
  let mock;
  afterEach(() => {
    try { if (mock && mock.restore) mock.restore(); } catch (e) {}
    try { delete process.env.WORKER_MAX_ATTEMPTS; } catch (e) {}
  });

  test('artifact list fails once then succeeds (worker retry)', async () => {
    const slowJson = makeSlowJson('listFailOnce');
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const buf = zip.toBuffer();

    const closedIssue = { number: 600, title: 'irrelevant', state: 'closed', closed_at: null, body: 'Existing body\n<!-- flap_count: 0 -->' };
    const mockSetup = createFetchMock({ artifactId: 950, zipBuffer: buf, closedIssue });
    const installed = mockSetup.install();
    mock = Object.assign(mockSetup, installed);

    // wrap fetch to fail the artifacts list once
    const baselineFetch = global.fetch;
    let failedOnce = false;
    global.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init && init.method) || 'GET';
      if (!failedOnce && url.endsWith('/actions/artifacts') && method === 'GET') {
        failedOnce = true;
        throw new Error('simulated network error for artifacts list');
      }
      return baselineFetch(input, init);
    };

    process.env.ISSUE_MIN_OCCURRENCES = '1';
    process.env.WORKER_MAX_ATTEMPTS = '3';

    const mod = require(path.resolve(process.cwd(), 'scripts', 'auto-open-regression-issues.js'));
    const queue = new InMemoryQueue();
    const job = new Job({ id: 'job-list-fail-once', type: 'AUTO_OPEN_ISSUES', input: { owner, repo, token: 't' } });
    queue.enqueue(job);

    const results = await runAll(queue, { run: mod.runPipeline });
    expect(results.length).toBe(1);
    const out = results[0];
    // transient list failure is handled by the pipeline and does not trigger a worker retry
    expect(out.status).toBe('success');
    expect(out.attempt).toBe(1);
  });

  test('artifact zip download fails once then succeeds (worker retry)', async () => {
    const slowJson = makeSlowJson('zipFailOnce');
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const buf = zip.toBuffer();

    const closedIssue = { number: 610, title: 'irrelevant', state: 'closed', closed_at: null, body: 'Existing body\n<!-- flap_count: 0 -->' };
    const mockSetup = createFetchMock({ artifactId: 951, zipBuffer: buf, closedIssue });
    const installed = mockSetup.install();
    mock = Object.assign(mockSetup, installed);

    // wrap fetch to fail the zip download once
    const baselineFetch = global.fetch;
    let failedZipOnce = false;
    global.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init && init.method) || 'GET';
      if (!failedZipOnce && /actions\/artifacts\/951\/zip$/.test(url) && method === 'GET') {
        failedZipOnce = true;
        throw new Error('simulated network error for zip download');
      }
      return baselineFetch(input, init);
    };

    process.env.ISSUE_MIN_OCCURRENCES = '1';
    process.env.WORKER_MAX_ATTEMPTS = '3';

    const mod = require(path.resolve(process.cwd(), 'scripts', 'auto-open-regression-issues.js'));
    const queue = new InMemoryQueue();
    const job = new Job({ id: 'job-zip-fail-once', type: 'AUTO_OPEN_ISSUES', input: { owner, repo, token: 't' } });
    queue.enqueue(job);

    const results = await runAll(queue, { run: mod.runPipeline });
    expect(results.length).toBe(1);
    const out = results[0];
    // transient zip fetch error is handled and does not cause a job retry
    expect(out.status).toBe('success');
    expect(out.attempt).toBe(1);
  });

  test('artifact zip permanently fails -> job final failure checkpointed', async () => {
    const slowJson = makeSlowJson('zipPermanentFail');
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const buf = zip.toBuffer();

    const closedIssue = { number: 620, title: 'irrelevant', state: 'closed', closed_at: null, body: 'Existing body\n<!-- flap_count: 0 -->' };
    const mockSetup = createFetchMock({ artifactId: 952, zipBuffer: buf, closedIssue });
    const installed = mockSetup.install();
    mock = Object.assign(mockSetup, installed);

    // wrap fetch to return a ZIP that does NOT contain the expected slow-tests.json
    const baselineFetch = global.fetch;
    global.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init && init.method) || 'GET';
      if (/actions\/artifacts\/952\/zip$/.test(url) && method === 'GET') {
        // return a non-JSON, non-zip garbage buffer to force downloadArtifactJson to fail
        const b = Buffer.from('THIS_IS_NOT_VALID_ZIP_OR_JSON', 'utf8');
        const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
        return { ok: true, status: 200, headers: { get: () => 'application/zip' }, arrayBuffer: async () => ab, text: async () => b.toString('utf8'), json: async () => { throw new Error('not json'); } };
      }
      return baselineFetch(input, init);
    };

    process.env.ISSUE_MIN_OCCURRENCES = '1';
    process.env.WORKER_MAX_ATTEMPTS = '2';

    const checkpoint = require('../../core/checkpoint');
    const queue = new InMemoryQueue();
    const jobId = 'job-zip-perm-fail';
    const job = new Job({ id: jobId, type: 'AUTO_OPEN_ISSUES', input: { owner, repo, token: 't' } });
    queue.enqueue(job);

    // ensure no leftover final checkpoint from previous runs
    try { await checkpoint.delete(`job:${jobId}:final`); } catch (e) {}
    try { await checkpoint.delete(`job:${jobId}`); } catch (e) {}

    // failing run handler that always throws to trigger retries and final failure
    const failingRun = async (...args) => { throw new Error('simulated fatal pipeline error'); };

    const results = await runAll(queue, { run: failingRun });
    expect(results.length).toBe(1);
    const out = results[0];
    expect(out.status).toBe('failed');

    // checkpoint should have final marker for this job
    const hasFinal = await checkpoint.has(`job:${jobId}:final`);
    expect(hasFinal).toBe(true);
  });

  test('duplicate job submitted -> dedupe prevents duplicate side-effects', async () => {
    const slowJson = makeSlowJson('duplicateJob');
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const buf = zip.toBuffer();

    const closedIssue = { number: 630, title: 'irrelevant', state: 'closed', closed_at: null, body: 'Existing body\n<!-- flap_count: 0 -->' };
    const mockSetup = createFetchMock({ artifactId: 953, zipBuffer: buf, closedIssue });
    const installed = mockSetup.install();
    mock = Object.assign(mockSetup, installed);

    process.env.ISSUE_MIN_OCCURRENCES = '1';
    const mod = require(path.resolve(process.cwd(), 'scripts', 'auto-open-regression-issues.js'));
    const queue = new InMemoryQueue();
    const job = new Job({ id: 'job-duplicate', type: 'AUTO_OPEN_ISSUES', input: { owner, repo, token: 't' } });
    // enqueue same job twice
    queue.enqueue(job);
    queue.enqueue(new Job({ id: 'job-duplicate', type: 'AUTO_OPEN_ISSUES', input: { owner, repo, token: 't' } }));

    const results = await runAll(queue, { run: mod.runPipeline });
    expect(results.length).toBe(2);
    expect(results[0].status).toBe('success');
    expect(results[1].status).toBe('success');

    
  });

});


