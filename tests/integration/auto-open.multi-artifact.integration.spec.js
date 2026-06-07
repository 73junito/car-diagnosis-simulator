 
// Ensure deterministic fetch/Request globals for this test file (run before any imports).
try { require('../../tests/jest-undici-register.js'); } catch (e) {}
const path = require('path');
const fs = require('fs');
const createFetchMock = require('../utils/createFetchMock');
let mock;

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

const owner = '73junito';
const repo = 'car-diagnosis-simulator';
const repoBase = `https://api.github.com`;

function makeSlowJson() {
  return { slow: [{ classname: 'TestClass', name: 'multiArtifactTest' }] };
}

describe('auto-open multi-artifact integration', () => {
  afterEach(() => {
    try { if (mock && mock.restore) mock.restore(); } catch (e) {}
    try { fs.rmSync(path.resolve(process.cwd(), 'config', 'test-owners.json'), { force: true }); } catch (e) {}
  });

  test('aggregates occurrences across multiple artifacts and reopens', async () => {
    const oldId = 401;
    const newId = 402;
    const slowJson = makeSlowJson();

    // two artifacts exist for slow-tests

    // both artifact downloads return ZIPs containing the same slow-tests.json
    const AdmZip = require('adm-zip');
    const zipOld = new AdmZip();
    zipOld.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const bufOld = zipOld.toBuffer();
    const zipNew = new AdmZip();
    zipNew.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const bufNew = zipNew.toBuffer();

    const issueTitle = `Slow test regression: TestClass — multiArtifactTest`;
    const closedIssue = { number: 405, title: issueTitle, state: 'closed', closed_at: null, body: 'Existing body\n<!-- flap_count: 0 -->' };
    // install fetch mock for artifacts, zips, and issues
    const mockSetup = createFetchMock({
      artifacts: [
        { id: oldId, name: 'slow-tests', created_at: '2026-01-01T00:00:00Z', zipBuffer: bufOld },
        { id: newId, name: 'slow-tests', created_at: '2026-02-01T00:00:00Z', zipBuffer: bufNew }
      ],
      closedIssue
    });
    const installed = mockSetup.install();
    mock = Object.assign(mockSetup, installed);
    // issues list / patch / comments are handled by the fetch mock; we get patchedBodies/postComments from it

    // reopen handled by the body-capturing PATCH above

    process.env.GITHUB_REPOSITORY = `${owner}/${repo}`;
    process.env.GITHUB_TOKEN = 't';
    process.env.ISSUE_LOOKBACK = '6';
    process.env.ISSUE_MIN_OCCURRENCES = '2';
    process.env.REOPEN_BACKOFF_RUNS = '0';
    process.env.NOTIFY_ON_REOPEN = 'false';

    const mod = require(path.resolve(process.cwd(), 'scripts', 'auto-open-regression-issues.js'));
    await mod.run();

    // ensure both artifact downloads were used (aggregated)
    const listKey = `GET /repos/${owner}/${repo}/actions/artifacts`;
    const oldZipKey = `GET /repos/${owner}/${repo}/actions/artifacts/${oldId}/zip`;
    const newZipKey = `GET /repos/${owner}/${repo}/actions/artifacts/${newId}/zip`;
    expect((mock.calls[listKey] || 0) >= 1).toBe(true);
    expect((mock.calls[oldZipKey] || 0) >= 1).toBe(true);
    expect((mock.calls[newZipKey] || 0) >= 1).toBe(true);

    // the script should have posted a comment and attempted to reopen the closed issue
    expect((mock.postComments || []).length).toBeGreaterThanOrEqual(1);

    // ensure flap_count was incremented in one of the PATCH bodies
    const toPayloadString = (p) => (typeof p === 'string' ? p : JSON.stringify(p));
    const payloadStrings = (mock.patchedBodies || []).map(toPayloadString);
    expect(payloadStrings.some(s => /<!--\s*flap_count:\s*1\s*-->/.test(s))).toBe(true);
  });
});
