const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const outFile = path.join(root, 'reports', 'last-commit-review.md');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_GENERATE_URL = process.env.OLLAMA_GENERATE_URL || `${OLLAMA_HOST}/api/generate`;

async function ollamaGenerate(model, prompt) {
  const res = await fetch(OLLAMA_GENERATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });

  if (!res.ok) throw new Error(`Ollama failed: ${res.status}`);
  const json = await res.json();
  return json.response || '';
}

async function main() {
  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });

  const diff = execSync('git diff HEAD~1 HEAD -- . ":!package-lock.json"', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10
  });

  const prompt = `Review this last Git commit for correctness, risks, missing tests, security issues, and CI impact.
Be concise. Include:
1. Summary
2. Risks
3. Recommended fixes
4. Test commands

Diff:
${diff}`;

  const output = await ollamaGenerate(process.env.OLLAMA_REVIEW_MODEL || 'qwen2.5-coder:7b', prompt);
  fs.writeFileSync(outFile, output, 'utf8');
  console.log(outFile);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
