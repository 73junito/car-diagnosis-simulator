const fs = require('fs');
const path = require('path');

const root = process.cwd();
const indexFile = path.join(root, '.ai', 'index.json');
const MODEL = process.env.OLLAMA_EMBED_MODEL || 'all-minilm:22m';

function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return dot / (Math.sqrt(aa) * Math.sqrt(bb) || 1);
}

async function embed(text) {
  const res = await fetch('http://127.0.0.1:11434/api/embed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: text })
  });

  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.embeddings) ? json.embeddings[0] : json.embedding;
}

async function main() {
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.error('Usage: node .github/hooks/search-codebase.js "query"');
    process.exit(2);
  }

  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  const q = await embed(query);

  const matches = index.records
    .map(r => ({ ...r, score: cosine(q, r.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  for (const m of matches) {
    console.log(`\n${m.score.toFixed(4)}  ${m.file}#chunk-${m.chunk}`);
    console.log(m.text.slice(0, 500).replace(/\s+/g, ' '));
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
