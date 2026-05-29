/* eslint-disable no-empty, no-unused-vars */
const path = require('path');
const fs = require('fs');
const nock = require('nock');

const owner = '73junito';
const repo = 'car-diagnosis-simulator';
const repoBase = `https://api.github.com`;

function makeSlowJson() {
  return { slow: [{ classname: 'TestClass', name: 'multiArtifactTest' }] };
}

describe('auto-open multi-artifact integration', () => {
  afterEach(() => {
    nock.cleanAll();
    try { fs.unlinkSync(path.resolve(process.cwd(), 'config', 'test-owners.json')); } catch (e) {}
  });

  test('aggregates occurrences across multiple artifacts and reopens', async () => {
    const oldId = 401;
    const newId = 402;
    const slowJson = makeSlowJson();

    // two artifacts exist for slow-tests
    nock(repoBase)
      .get(`/repos/${owner}/${repo}/actions/artifacts`)
      .times(3)
      .reply(200, { artifacts: [
        { id: oldId, name: 'slow-tests', created_at: '2026-01-01T00:00:00Z' },
        { id: newId, name: 'slow-tests', created_at: '2026-02-01T00:00:00Z' }
      ] });

    // both artifact downloads return ZIPs containing the same slow-tests.json
    const AdmZip = require('adm-zip');
    const zipOld = new AdmZip();
    zipOld.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const bufOld = zipOld.toBuffer();
    const zipNew = new AdmZip();
    zipNew.addFile('slow-tests.json', Buffer.from(JSON.stringify(slowJson), 'utf8'));
    const bufNew = zipNew.toBuffer();

    const oldScope = nock(repoBase)
      .get(`/repos/${owner}/${repo}/actions/artifacts/${oldId}/zip`)
      .reply(200, bufOld, { 'Content-Type': 'application/zip' });

    const newScope = nock(repoBase)
      .get(`/repos/${owner}/${repo}/actions/artifacts/${newId}/zip`)
      .reply(200, bufNew, { 'Content-Type': 'application/zip' });

    const issueTitle = `Slow test regression: TestClass — multiArtifactTest`;
    const closedIssue = { number: 405, title: issueTitle, state: 'closed', closed_at: null, body: 'Existing body\n<!-- flap_count: 0 -->' };
    nock(repoBase)
      .get(`/repos/${owner}/${repo}/issues`)
      .query(true)
      .reply(200, [ closedIssue ]);

    // capture metadata PATCH and comment/reopen
    const patchedBodies = [];
    nock(repoBase)
      .patch(`/repos/${owner}/${repo}/issues/${closedIssue.number}`, (body) => { patchedBodies.push(body); return true; })
      .times(2)
      .reply(200, { number: closedIssue.number });

    const commentScope = nock(repoBase)
      .post(`/repos/${owner}/${repo}/issues/${closedIssue.number}/comments`)
      .reply(201, {});

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
    expect(oldScope.isDone()).toBe(true);
    expect(newScope.isDone()).toBe(true);

    // the script should have posted a comment and attempted to reopen the closed issue
    expect(commentScope.isDone()).toBe(true);

    // ensure flap_count was incremented in one of the PATCH bodies
    const toPayloadString = (p) => (typeof p === 'string' ? p : JSON.stringify(p));
    const payloadStrings = patchedBodies.map(toPayloadString);
    expect(payloadStrings.some(s => /<!--\s*flap_count:\s*1\s*-->/.test(s))).toBe(true);
  });
});
