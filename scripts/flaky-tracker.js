const fs = require('fs');
const path = require('path');
const fetch = global.fetch || require('node-fetch');
const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');

async function downloadLatestHistory(owner, repo, token) {
  const api = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts`;
  const res = await fetch(api, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const j = await res.json();
  const artifacts = j.artifacts || [];
  // find latest artifact named flaky-history
  const candidate = artifacts
    .filter(a => a.name === 'flaky-history')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  if (!candidate) return null;
  const downloadUrl = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${candidate.id}/zip`;
  const dl = await fetch(downloadUrl, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } });
  if (!dl.ok) return null;
  const buffer = Buffer.from(await dl.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry('flaky-history.json') || zip.getEntries().find(e => e.entryName.endsWith('flaky-history.json'));
  if (!entry) return null;
  const content = entry.getData().toString('utf8');
  return JSON.parse(content);
}

function parseJUnitFailures(junitPath) {
  if (!fs.existsSync(junitPath)) return [];
  const xml = fs.readFileSync(junitPath, 'utf8');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const json = parser.parse(xml);
  const testsuites = json.testsuites || { testsuite: json.testsuite || [] };
  const suites = Array.isArray(testsuites.testsuite) ? testsuites.testsuite : [testsuites.testsuite];
  const failing = [];
  for (const s of suites) {
    const cases = s.testcase ? (Array.isArray(s.testcase) ? s.testcase : [s.testcase]) : [];
    for (const c of cases) {
      if (c.failure) {
        const name = c['@_name'] || c.name || 'unknown';
        const cls = c['@_classname'] || c.classname || '';
        failing.push(`${cls} — ${name}`);
      }
    }
  }
  return failing;
}

async function run() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const runId = process.env.GITHUB_RUN_ID;
  const prNumber = process.env.PR_NUMBER;
  if (!repo || !token) {
    console.log('Missing GITHUB_REPOSITORY or GITHUB_TOKEN — skipping flaky tracking.');
    return;
  }
  const [owner, repoName] = repo.split('/');
  const junitPath = path.resolve(process.cwd(), 'test-results', 'junit.xml');
  const failures = parseJUnitFailures(junitPath);

  let history = await downloadLatestHistory(owner, repoName, token).catch(() => null) || { updatedAt: null, runs: [], tests: {} };

  const timestamp = new Date().toISOString();
  const runRecord = { runId, timestamp, failures };
  history.runs = (history.runs || []).slice(-99).concat([runRecord]);
  // update tests map
  const testsMap = history.tests || {};
  // increment totalRuns for all known tests
  for (const t of Object.keys(testsMap)) {
    testsMap[t].totalRuns = (testsMap[t].totalRuns || 0) + 1;
  }
  for (const f of failures) {
    if (!testsMap[f]) testsMap[f] = { totalRuns: 0, flakeCount: 0, lastFailureAt: null };
    testsMap[f].flakeCount = (testsMap[f].flakeCount || 0) + 1;
    testsMap[f].lastFailureAt = timestamp;
  }
  history.tests = testsMap;
  history.updatedAt = timestamp;

  const outDir = path.resolve(process.cwd(), 'test-results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'flaky-history.json');
  fs.writeFileSync(outPath, JSON.stringify(history, null, 2));
  console.log(`Wrote flaky history to ${outPath}`);

  // If any test has flakeCount >= threshold (3), post a PR comment warning
  const threshold = Number(process.env.FLAKY_THRESHOLD || 3);
  const flakyTests = Object.entries(testsMap).filter(([name, data]) => (data.flakeCount || 0) >= threshold).map(([n]) => n);
  if (prNumber && flakyTests.length) {
    const body = `<!-- flaky-summary -->\n**Flaky tests detected** (>= ${threshold} failures):\n${flakyTests.slice(0, 20).map(t => `- ${t}`).join('\n')}\n`;
    await postOrUpdateComment(owner, repoName, prNumber, body, token);
  }
}

async function postOrUpdateComment(owner, repo, prNumber, body, token) {
  const apiBase = 'https://api.github.com';
  const listUrl = `${apiBase}/repos/${owner}/${repo}/issues/${prNumber}/comments`;
  const headers = { Authorization: `token ${token}`, 'User-Agent': 'flaky-tracker' };
  const res = await fetch(listUrl, { headers });
  const comments = await res.json();
  const existing = comments.find(c => c.body && c.body.includes('<!-- flaky-summary -->'));
  if (existing) {
    const patchUrl = `${apiBase}/repos/${owner}/${repo}/issues/comments/${existing.id}`;
    await fetch(patchUrl, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    console.log('Updated existing flaky tests comment.');
  } else {
    const postUrl = `${apiBase}/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    await fetch(postUrl, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    console.log('Posted new flaky tests comment.');
  }
}

run().catch(err => { console.error(err); process.exit(1); });
