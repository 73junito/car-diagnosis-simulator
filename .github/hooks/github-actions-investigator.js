const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const outFile = path.join(root, 'reports', 'github-actions-failure.md');
const MODEL = process.env.OLLAMA_GITHUB_ACTIONS_MODEL || 'qwen2.5-coder:7b';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_GENERATE_URL = process.env.OLLAMA_GENERATE_URL || `${OLLAMA_HOST}/api/generate`;

async function ollamaGenerate(model, prompt) {
  const res = await fetch(OLLAMA_GENERATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama failed: ${res.status}`);
  }

  const json = await res.json();
  return json.response || '';
}

function run(cmd) {
  return execSync(cmd, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
}

async function main() {
  const runId = process.argv[2];

  if (!runId) {
    console.error('Usage: node .github/hooks/github-actions-investigator.js <run-id>');
    process.exit(2);
  }

  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });

  let runSummary = '';
  let failedLog = '';

  try {
    runSummary = run(`gh run view ${runId}`);
  } catch (e) {
    runSummary = String(e);
  }

  try {
    failedLog = run(`gh run view ${runId} --log-failed`);
  } catch (e) {
    failedLog = String(e);
  }

  const prompt = `
Analyze this GitHub Actions failure.

Provide:
1. Root cause
2. Failed workflow/job/step
3. Exact error
4. Recommended fix
5. Verification commands
6. Files likely needing changes

RUN SUMMARY:
${runSummary}

FAILED LOG:
${failedLog}
`;

  const result = await ollamaGenerate(MODEL, prompt);

  fs.writeFileSync(outFile, result, 'utf8');

  console.log(`Report written to ${outFile}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});