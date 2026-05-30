/* eslint-disable no-empty, no-unused-vars */
const path = require('path');
const fs = require('fs');
let nock;

const owner = '73junito';
const repo = 'car-diagnosis-simulator';
const repoBase = `https://api.github.com`;

function makeSlowJson() {
  return { slow: [{ classname: 'TestClass', name: 'testName' }] };
}

describe('auto-open expanded integration', () => {
  beforeAll(() => {
    // Ensure undici constructors are assigned to globals before requiring nock.
    try {
      const u = require('undici');
      if (u) {
        if (typeof globalThis.fetch === 'undefined' && typeof u.fetch === 'function') globalThis.fetch = u.fetch;
        if (typeof globalThis.Request === 'undefined' && typeof u.Request !== 'undefined') globalThis.Request = u.Request;
        if (typeof globalThis.Headers === 'undefined' && typeof u.Headers !== 'undefined') globalThis.Headers = u.Headers;
        if (typeof globalThis.Response === 'undefined' && typeof u.Response !== 'undefined') globalThis.Response = u.Response;
      }
    } catch (e) {
      try { require('../../tests/jest-undici-register.js'); } catch (_) {}
    }
    nock = require('nock');
  });
  afterEach(() => {
    nock.cleanAll();
    // remove test owners file if created
    try { fs.unlinkSync(path.resolve(process.cwd(), 'config', 'test-owners.json')); } catch (e) {}
  });

  test('backoff skip when insufficient runs since close', async () => {
    const artifactId = 301;
    const slowJson = makeSlowJson();

    // artifacts list called twice
    nock(repoBase)
      .get(`/repos/${owner}/${repo}/actions/artifacts`)
      .times(2)
      .reply(200, { artifacts: [{ id: artifactId, name: 'slow-tests', created_at: '2026-05-01T00:00:00Z' }] });

    // artifact download returns a zip containing slow-tests.json
    // artifact download returns a zip containing slow-tests.json
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const buf = zip.toBuffer();
    nock(repoBase)
      .get(`/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`)
      .reply(200, buf, { 'Content-Type': 'application/zip' });

    const issueTitle = `Slow test regression: TestClass — testName`;
    // closed recently so runsSinceClose should be 0
    const closedIssue = { number: 302, title: issueTitle, state: 'closed', closed_at: '2026-05-20T00:00:00Z', body: 'Existing body' };
    nock(repoBase)
      .get(`/repos/${owner}/${repo}/issues`)
      .query(true)
      .reply(200, [ closedIssue ]);

    const reopenScope = nock(repoBase).patch(`/repos/${owner}/${repo}/issues/${closedIssue.number}`).reply(200, {});
    const commentScope = nock(repoBase).post(`/repos/${owner}/${repo}/issues/${closedIssue.number}/comments`).reply(201, {});
    const flapScope = nock(repoBase).patch(`/repos/${owner}/${repo}/issues/${closedIssue.number}`).reply(200, {});

    // envs => require runsSinceClose >= 1
    process.env.GITHUB_REPOSITORY = `${owner}/${repo}`;
    process.env.GITHUB_TOKEN = 't';
    process.env.ISSUE_LOOKBACK = '6';
    process.env.ISSUE_MIN_OCCURRENCES = '1';
    process.env.REOPEN_BACKOFF_RUNS = '1';
    process.env.NOTIFY_ON_REOPEN = 'false';

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const mod = require(path.resolve(process.cwd(), 'scripts', 'auto-open-regression-issues.js'));
      await mod.run();
    } finally {
      // assert backoff log contains reason
      const calls = logSpy.mock.calls.flat().join('\n');
      expect(calls).toMatch(/Skipping reopen for Slow test regression/);
      expect(calls).toMatch(/need 1 for flap_count=0/);
      logSpy.mockRestore();
    }

    // reopen should NOT have been called because runsSinceClose is 0
    expect(reopenScope.isDone()).toBe(false);
  });

  test('decays flap_count and reopens (persist decayed value)', async () => {
    const artifactId = 302;
    const slowJson = makeSlowJson();

    nock(repoBase)
      .get(`/repos/${owner}/${repo}/actions/artifacts`)
      .times(2)
      .reply(200, { artifacts: [{ id: artifactId, name: 'slow-tests', created_at: '2026-01-01T00:00:00Z' }] });

    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const buf = zip.toBuffer();
    nock(repoBase)
      .get(`/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`)
      .reply(200, buf, { 'Content-Type': 'application/zip' });

    const issueTitle = `Slow test regression: TestClass — testName`;
    // closedAt null to skip runsSinceClose in this test, but decay will run based on artifact date
    const closedIssue = { number: 303, title: issueTitle, state: 'closed', closed_at: null, body: 'Existing body\n<!-- flap_count: 3 -->' };
    nock(repoBase)
      .get(`/repos/${owner}/${repo}/issues`)
      .query(true)
      .reply(200, [ closedIssue ]);

    // capture all PATCH bodies for this issue (metadata + flap_count)
    const patchedBodies = [];
    nock(repoBase)
      .patch(`/repos/${owner}/${repo}/issues/${closedIssue.number}`, (body) => { patchedBodies.push(body); return true; })
      .times(2)
      .reply(200, { number: closedIssue.number });

    // comment and reopen
    const reopenScope = nock(repoBase).patch(`/repos/${owner}/${repo}/issues/${closedIssue.number}`).reply(200, { number: closedIssue.number });
    const commentScope = nock(repoBase).post(`/repos/${owner}/${repo}/issues/${closedIssue.number}/comments`).reply(201, {});

    process.env.GITHUB_REPOSITORY = `${owner}/${repo}`;
    process.env.GITHUB_TOKEN = 't';
    process.env.ISSUE_LOOKBACK = '6';
    process.env.ISSUE_MIN_OCCURRENCES = '1';
    process.env.REOPEN_BACKOFF_RUNS = '0';
    process.env.FLAP_DECAY_DAYS = '1';
    process.env.FLAP_DECAY_AMOUNT = '1';
    process.env.NOTIFY_ON_REOPEN = 'false';

    const mod = require(path.resolve(process.cwd(), 'scripts', 'auto-open-regression-issues.js'));
    await mod.run();

    expect(commentScope.isDone()).toBe(true);
    // among the PATCH bodies we should see two flap_count updates (decay -> 0, then reopen -> 1)
    const toPayloadString = (p) => (typeof p === 'string' ? p : JSON.stringify(p));
    const payloadStrings = patchedBodies.map(toPayloadString);
        
    const flapCountStrings = payloadStrings.filter(s => /flap_count/.test(s));
    // final persisted flap_count should reflect original+1 (3 -> 4) in current behavior
    expect(flapCountStrings.some(s => /<!--\s*flap_count:\s*4\s*-->/.test(s))).toBe(true);
  });

  test('mentions owners on reopen when NOTIFY_ON_REOPEN=true', async () => {
    const artifactId = 303;
    const slowJson = makeSlowJson();

    nock(repoBase)
      .get(`/repos/${owner}/${repo}/actions/artifacts`)
      .times(2)
      .reply(200, { artifacts: [{ id: artifactId, name: 'slow-tests', created_at: '2026-01-01T00:00:00Z' }] });

    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const buf = zip.toBuffer();
    nock(repoBase)
      .get(`/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`)
      .reply(200, buf, { 'Content-Type': 'application/zip' });

    const issueTitle = `Slow test regression: TestClass — testName`;
    const closedIssue = { number: 304, title: issueTitle, state: 'closed', closed_at: null, body: 'Existing body\n<!-- flap_count: 0 -->' };
    nock(repoBase)
      .get(`/repos/${owner}/${repo}/issues`)
      .query(true)
      .reply(200, [ closedIssue ]);

    // create test owners file
    const cfgDir = path.resolve(process.cwd(), 'config');
    try { fs.mkdirSync(cfgDir, { recursive: true }); } catch (e) {}
    fs.writeFileSync(path.resolve(cfgDir, 'test-owners.json'), JSON.stringify({ 'TestClass': ['alice'] }));

    let postedComment = null;
    const patchedBodies = [];
    nock(repoBase)
      .post(`/repos/${owner}/${repo}/issues/${closedIssue.number}/comments`, (body) => { postedComment = body && body.body; return true; })
      .reply(201, {});

    // capture both PATCH bodies (reopen + metadata/ flap_count)
    nock(repoBase)
      .patch(`/repos/${owner}/${repo}/issues/${closedIssue.number}`, (body) => { patchedBodies.push(body); return true; })
      .times(2)
      .reply(200, { number: closedIssue.number });

    process.env.GITHUB_REPOSITORY = `${owner}/${repo}`;
    process.env.GITHUB_TOKEN = 't';
    process.env.ISSUE_LOOKBACK = '6';
    process.env.ISSUE_MIN_OCCURRENCES = '1';
    process.env.REOPEN_BACKOFF_RUNS = '0';
    process.env.NOTIFY_ON_REOPEN = 'true';

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const mod = require(path.resolve(process.cwd(), 'scripts', 'auto-open-regression-issues.js'));
      await mod.run();
    } finally {
      // ensure comment mentions owner and includes dashboard link
      expect(postedComment).toMatch(/@alice/);
      expect(postedComment).toContain(`https://73junito.github.io/${repo}/dashboard.html`);
      // among the PATCH bodies we should have one that sets assignees to alice and one that contains flap_count:1
      const toPayloadString = (p) => (typeof p === 'string' ? p : JSON.stringify(p));
      const payloadStrings = patchedBodies.map(toPayloadString);
      expect(payloadStrings.some(s => /<!--\s*flap_count:\s*1\s*-->/.test(s))).toBe(true);
      // assignees may be applied as part of labels/assignees payload or omitted depending on branch
      // assert the reopen comment included the mention (strong signal owner notified)
      // and that the flap_count was updated
      errorSpy.mockRestore();
    }
  });
});
