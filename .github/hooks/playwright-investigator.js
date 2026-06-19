const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outFile = path.join(root, 'reports', 'playwright-investigation.md');

function collectFiles(dir, names = []) {
  if (!fs.existsSync(dir)) return names;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) collectFiles(full, names);
    else if (['error-context.md', 'test-results.json'].includes(item.name) || item.name.endsWith('.log')) names.push(full);
  }
  return names;
}

async function ollamaGenerate(model, prompt) {
  const res = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  if (!res.ok) throw new Error(`Ollama failed: ${res.status}`);
  return (await res.json()).response || '';
}

async function main() {
  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
  const files = [...collectFiles(path.join(root, 'test-results')), ...collectFiles(path.join(root, 'playwright-report'))];

  const content = files.map(file => `--- ${path.relative(root, file)} ---\n${fs.readFileSync(file, 'utf8').slice(0, 12000)}`).join('\n\n');

  const output = await ollamaGenerate(process.env.OLLAMA_PLAYWRIGHT_MODEL || 'qwen2.5-coder:7b',
`Analyze this Playwright failure. Include root cause, failing selector/assertion, best-practice fix, replacement code, and verify commands.

${content}`);

  fs.writeFileSync(outFile, output, 'utf8');
  console.log(outFile);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
