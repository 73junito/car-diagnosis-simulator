const fs = require('fs');
const path = require('path');

const { XMLParser } = require('fast-xml-parser');

async function run() {
  const prNumber = process.env.PR_NUMBER;
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;

  if (!prNumber) {
    console.log('PR_NUMBER not set — skipping PR comment.');
    return;
  }
  if (!repo || !token) {
    console.log('GITHUB_REPOSITORY or GITHUB_TOKEN not set — cannot post comment.');
    return;
  }

  const junitPath = path.resolve(process.cwd(), 'test-results', 'junit.xml');
  if (!fs.existsSync(junitPath)) {
    await postComment(repo, prNumber, `<!-- junit-summary -->\n**Test results:** No JUnit report found (expected at \`test-results/junit.xml\`).` , token);
    return;
  }

  const xml = fs.readFileSync(junitPath, 'utf8');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const json = parser.parse(xml);

  // Normalize structure
  const testsuites = json.testsuites || { testsuite: json.testsuite || [] };
  const suites = Array.isArray(testsuites.testsuite) ? testsuites.testsuite : [testsuites.testsuite];

  let total = 0;
  let failures = 0;
  const failing = [];

  for (const s of suites) {
    const cases = s.testcase ? (Array.isArray(s.testcase) ? s.testcase : [s.testcase]) : [];
    total += Number(s['@_tests'] || cases.length || 0);
    failures += Number(s['@_failures'] || 0);
    for (const c of cases) {
      if (c.failure) {
        const name = c['@_name'] || c.name || '';
        const cls = c['@_classname'] || c.classname || '';
        failing.push(`${cls} — ${name}`);
      }
    }
  }

  const status = failures > 0 ? `❌ ${failures} failing test(s)` : `✅ All tests passed (${total} tests)`;

  let body = `<!-- junit-summary -->\n**Test results:** ${status}\n`;
  const [owner, repoName] = repo.split('/');
  const dashboardUrl = `https://${owner}.github.io/${repoName}/dashboard.html`;
  body += `\n**Live dashboard:** [Open test dashboard](${dashboardUrl})\n`;
  if (failing.length) {
    body += '\n**Failing tests (top 10):**\n';
    for (const f of failing.slice(0, 10)) body += `- ${f}\n`;
  }

  await postComment(repo, prNumber, body, token);
}

async function postComment(repo, prNumber, body, token) {
  const [owner, repoName] = repo.split('/');
  const apiBase = 'https://api.github.com';

  // Find existing comment created by this action (marker: <!-- junit-summary -->)
  const listUrl = `${apiBase}/repos/${owner}/${repoName}/issues/${prNumber}/comments`;
  const headers = { Authorization: `token ${token}`, 'User-Agent': 'junit-summary-action' };
  const res = await fetch(listUrl, { headers });
  if (!res.ok) {
    console.log(`Skipped PR comment update: GitHub list request failed (${res.status}).`);
    return false;
  }

  const payload = await res.json();
  if (!Array.isArray(payload)) {
    console.log('Skipped PR comment update: GitHub returned a non-array comments payload.');
    return false;
  }

  const existing = payload.find(c => c.body && c.body.includes('<!-- junit-summary -->'));
  if (existing) {
    const patchUrl = `${apiBase}/repos/${owner}/${repoName}/issues/comments/${existing.id}`;
    const patchRes = await fetch(patchUrl, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    if (!patchRes.ok) {
      console.log(`Skipped PR comment update: GitHub PATCH request failed (${patchRes.status}).`);
      return false;
    }
    console.log('Updated existing PR comment.');
    return true;
  } else {
    const postUrl = `${apiBase}/repos/${owner}/${repoName}/issues/${prNumber}/comments`;
    const postRes = await fetch(postUrl, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    if (!postRes.ok) {
      console.log(`Skipped PR comment update: GitHub POST request failed (${postRes.status}).`);
      return false;
    }
    console.log('Posted new PR comment.');
    return true;
  }
}

run().catch(err => { console.error(err); process.exit(1); });
