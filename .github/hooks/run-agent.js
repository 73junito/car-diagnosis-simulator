const fs = require('fs');
const path = require('path');

const root = process.cwd();
const registryPath = path.join(root, '.github', 'agents', 'registry.json');

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function readText(file, fallback = '') {
  try { return fs.readFileSync(file, 'utf8'); } catch { return fallback; }
}

async function ollamaGenerate(model, prompt) {
  const res = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });

  if (!res.ok) throw new Error(`Ollama failed: ${res.status}`);
  const json = await res.json();
  return json.response || '';
}

async function main() {
  const task = process.argv[2];
  const inputFile = process.argv[3];

  if (!task) {
    console.error('Usage: node .github/hooks/run-agent.js <task> [input-file]');
    process.exit(2);
  }

  const registry = readJson(registryPath);
  const entry = registry[task];

  if (!entry) {
    console.error(`Unknown task: ${task}`);
    console.error(`Available: ${Object.keys(registry).join(', ')}`);
    process.exit(2);
  }

  const promptPath = path.join(root, entry.prompt || '');
  const basePrompt = readText(promptPath, `You are the ${entry.agent || task} agent.`);
  const input = inputFile ? readText(path.resolve(root, inputFile)) : '';

  const fullPrompt = `${basePrompt}

Repository: ${root}
Task: ${task}

Input:
${input}
`;

  const output = await ollamaGenerate(entry.model, fullPrompt);

  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
  const outFile = path.join(root, 'reports', `${task.replace(/_/g, '-')}.md`);
  fs.writeFileSync(outFile, output, 'utf8');

  console.log(outFile);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
