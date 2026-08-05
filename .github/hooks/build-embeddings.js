const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outDir = path.join(root, '.ai');
const outFile = path.join(outDir, 'index.json');

const MODEL = process.env.OLLAMA_EMBED_MODEL || 'all-minilm:22m';
const INCLUDE_DIRS = ['core', 'lib', 'services', 'scripts', 'tests', 'docs', 'dashboard', 'api'];
const EXTENSIONS = new Set(['.js', '.json', '.md', '.html', '.css', '.yml', '.yaml']);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);

    if (item.isDirectory()) {
      if (['node_modules', '.git', 'playwright-report', 'test-results'].includes(item.name)) continue;
      walk(full, files);
    } else if (EXTENSIONS.has(path.extname(item.name))) {
      files.push(full);
    }
  }

  return files;
}

function chunks(text, size = 2500) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_EMBED_URL = process.env.OLLAMA_EMBED_URL || `${OLLAMA_HOST}/api/embed`;

async function embed(text) {
  const res = await fetch(OLLAMA_EMBED_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: text })
  });

  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
  const json = await res.json();

  if (Array.isArray(json.embeddings)) return json.embeddings[0];
  if (Array.isArray(json.embedding)) return json.embedding;

  throw new Error('No embedding returned from Ollama.');
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const files = INCLUDE_DIRS.flatMap(dir => walk(path.join(root, dir)));
  const records = [];

  for (const file of files) {
    const rel = path.relative(root, file);
    const text = fs.readFileSync(file, 'utf8');

    for (const [index, chunk] of chunks(text).entries()) {
      if (!chunk.trim()) continue;
      console.log(`Embedding ${rel} chunk ${index + 1}`);
      records.push({
        file: rel,
        chunk: index,
        text: chunk,
        embedding: await embed(chunk)
      });
    }
  }

  fs.writeFileSync(outFile, JSON.stringify({
    model: MODEL,
    createdAt: new Date().toISOString(),
    records
  }, null, 2));

  console.log(`Wrote ${outFile}`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
