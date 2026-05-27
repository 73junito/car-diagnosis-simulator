const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

function parseJUnitTimes(junitPath) {
  if (!fs.existsSync(junitPath)) return [];
  const xml = fs.readFileSync(junitPath, 'utf8');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const json = parser.parse(xml);
  const testsuites = json.testsuites || { testsuite: json.testsuite || [] };
  const suites = Array.isArray(testsuites.testsuite) ? testsuites.testsuite : [testsuites.testsuite];
  const results = [];
  for (const s of suites) {
    const cases = s.testcase ? (Array.isArray(s.testcase) ? s.testcase : [s.testcase]) : [];
    for (const c of cases) {
      const name = c['@_name'] || c.name || 'unknown';
      const cls = c['@_classname'] || c.classname || '';
      const timeAttr = c['@_time'] || c.time || '0';
      const seconds = parseFloat(timeAttr || '0');
      const ms = Math.round(seconds * 1000);
      results.push({ name, classname: cls, timeMs: ms });
    }
  }
  return results;
}

function detectSlowTests(results, thresholdMs) {
  return results.filter(r => r.timeMs >= thresholdMs).sort((a,b)=>b.timeMs-a.timeMs);
}

async function run() {
  const junitPath = path.resolve(process.cwd(), 'test-results', 'junit.xml');
  const thresholdMs = Number(process.env.SLOW_TEST_MS || 2000);
  const topN = Number(process.env.SLOW_TEST_TOP || 20);
  const prNumber = process.env.PR_NUMBER;
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;

  const results = parseJUnitTimes(junitPath);
  const slow = detectSlowTests(results, thresholdMs);

  const outDir = path.resolve(process.cwd(), 'test-results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'slow-tests.json');
  fs.writeFileSync(outPath, JSON.stringify({ updatedAt: new Date().toISOString(), thresholdMs, slow }, null, 2));
  console.log(`Wrote slow tests to ${outPath}`);

  if (prNumber && repo && token && slow.length) {
    const { GITHUB_API = 'https://api.github.com' } = process.env;
    const [owner, repoName] = repo.split('/');
    const body = `<!-- slow-tests -->\n**Slow tests detected (>= ${thresholdMs}ms):**\n${slow.slice(0, topN).map(s => `- ${s.classname} — ${s.name} — ${s.timeMs}ms`).join('\n')}\n`;
    // post or update PR comment
    const listUrl = `${GITHUB_API}/repos/${owner}/${repoName}/issues/${prNumber}/comments`;
    const headers = { Authorization: `token ${token}`, 'User-Agent': 'slow-test-detector' };
    const fetch = global.fetch || require('node-fetch');
    const res = await fetch(listUrl, { headers });
    const comments = await res.json();
    const existing = comments.find(c => c.body && c.body.includes('<!-- slow-tests -->'));
    if (existing) {
      const patchUrl = `${GITHUB_API}/repos/${owner}/${repoName}/issues/comments/${existing.id}`;
      await fetch(patchUrl, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      console.log('Updated existing slow-tests comment.');
    } else {
      const postUrl = `${GITHUB_API}/repos/${owner}/${repoName}/issues/${prNumber}/comments`;
      await fetch(postUrl, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      console.log('Posted new slow-tests comment.');
    }
  }
}

run().catch(err => { console.error(err); process.exit(1); });
