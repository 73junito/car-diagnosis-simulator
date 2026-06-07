// Clean helper-based integration tests for auto-open script.
try { require('../../tests/jest-undici-register.js'); } catch (e) {}
const path = require('path');
const fs = require('fs');
const createFetchMock = require('../utils/createFetchMock');

const owner = '73junito';
const repo = 'car-diagnosis-simulator';

function makeSlowJson() {
  return { slow: [{ classname: 'TestClass', name: 'testName' }] };
}

describe('auto-open expanded integration', () => {
  beforeAll(() => {
    try {
      if (typeof globalThis.MessagePort === 'undefined') {
        try {
          const { MessageChannel, MessagePort } = require('worker_threads');
          globalThis.MessageChannel = MessageChannel;
          globalThis.MessagePort = MessagePort;
        } catch (e) {}
      }
    } catch (e) {}

    const { fetch, Request, Headers, Response } = require('undici');
    globalThis.fetch = fetch;
    globalThis.Request = Request;
    globalThis.Headers = Headers;
    globalThis.Response = Response;
  });

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    try {
      fs.rmSync(path.resolve(process.cwd(), 'config', 'test-owners.json'), { force: true });
    } catch (e) {}
  });

  test('backoff skip when insufficient runs since close', async () => {
    const artifactId = 301;
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('slow-tests.json', Buffer.from(JSON.stringify(makeSlowJson()), 'utf8'));
    const buf = zip.toBuffer();

    const issueTitle = `Slow test regression: TestClass — testName`;
    const closedIssue = { number: 302, title: issueTitle, state: 'closed', closed_at: '2026-05-20T00:00:00Z', body: 'Existing body' };

    const mock = createFetchMock({ artifactId, zipBuffer: buf, closedIssue });
    const { patchedBodies, postComments, restore } = mock.install();

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
      expect(logSpy).toHaveBeenCalled();
      const calls = logSpy.mock.calls.flat().join('\n');
      expect(calls).toMatch(/Skipping reopen for Slow test regression/);
      expect(calls).toMatch(/need 1 for flap_count=0/);
      logSpy.mockRestore();
      restore();
    }

    const reopenPatch = (patchedBodies || []).find(b => b && b.state === 'open');
    expect(reopenPatch).toBeUndefined();
  });

  test('decays flap_count and reopens (persist decayed value)', async () => {
    const artifactId = 302;
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('slow-tests.json', Buffer.from(JSON.stringify(makeSlowJson()), 'utf8'));
    const buf = zip.toBuffer();

    const closedIssue = { number: 303, title: `Slow test regression: TestClass — testName`, state: 'closed', closed_at: null, body: 'Existing body\n<!-- flap_count: 3 -->' };

    const mock = createFetchMock({ artifactId, zipBuffer: buf, closedIssue });
    const { patchedBodies, postComments, restore } = mock.install();

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

    expect(postComments.length).toBeGreaterThan(0);
    const payloadStrings = patchedBodies.map(p => (typeof p === 'string' ? p : JSON.stringify(p)));
    expect(payloadStrings.some(s => /<!--\s*flap_count:\s*1\s*-->/.test(s))).toBe(true);
    restore();
  });

  test('mentions owners on reopen when NOTIFY_ON_REOPEN=true', async () => {
    const artifactId = 303;
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('slow-tests.json', Buffer.from(JSON.stringify(makeSlowJson()), 'utf8'));
    const buf = zip.toBuffer();

    const closedIssue = { number: 304, title: `Slow test regression: TestClass — testName`, state: 'closed', closed_at: null, body: 'Existing body\n<!-- flap_count: 0 -->' };

    const cfgDir = path.resolve(process.cwd(), 'config');
    try { fs.mkdirSync(cfgDir, { recursive: true }); } catch (e) {}
    fs.writeFileSync(path.resolve(cfgDir, 'test-owners.json'), JSON.stringify({ 'TestClass': ['alice'] }));

    const mock = createFetchMock({ artifactId, zipBuffer: buf, closedIssue });
    const { patchedBodies, postComments, restore } = mock.install();

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
      const posted = postComments[0] && postComments[0].body;
      expect(posted).toMatch(/@alice/);
      expect(posted).toContain(`https://73junito.github.io/${repo}/dashboard.html`);
      const payloadStrings = patchedBodies.map(p => (typeof p === 'string' ? p : JSON.stringify(p)));
      expect(payloadStrings.some(s => /<!--\s*flap_count:\s*1\s*-->/.test(s))).toBe(true);
      errorSpy.mockRestore();
      restore();
    }
  });
});
