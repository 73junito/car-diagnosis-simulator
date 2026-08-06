#!/usr/bin/env node
/*
  Ingest an approved source (text/html/plain) and emit a draft source manifest
  and draft chunk file by invoking build-approved-source-chunks.js.

  Rules:
  - Requires `--id`, `--title`, and `--license` metadata (fail closed if missing)
  - Never mark sources or chunks as approved
  - Output under `data/approved-sources/drafts/<id>.json` and `data/approved-chunks/drafts/<id>-chunks.json`
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { buildChunksFromManifest, writeChunks } = require('./build-approved-source-chunks');

function extractTextFromHtml(html) {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  // remove potentially executable elements
  document.querySelectorAll('script, style, iframe, object, embed, template, noscript').forEach(e => e.remove());
  return document.body?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function usage() {
  console.error('Usage: ingest-approved-source --file <file> --id <source-id> --title <title> --license <text> [--version X]');
  process.exit(2);
}

if (require.main === module) {
  const argv = require('minimist')(process.argv.slice(2));
  const file = argv.file || argv.f;
  const id = argv.id;
  const title = argv.title;
  const license = argv.license;
  const version = argv.version || 1;

  if (!file || !id || !title || !license) usage();
  if (!fs.existsSync(file)) { console.error('file not found'); process.exit(3); }

  const ext = path.extname(file).toLowerCase();
  let text = fs.readFileSync(file, 'utf8');
  if (ext === '.html' || ext === '.htm') text = extractTextFromHtml(text);

  // split into sections by form-feed or by large paragraphs
  const rawSections = text.split(/\f|\n\n(?=\S)/g).map((t, i) => ({
    page: null,
    chapterTitle: null,
    sectionTitle: null,
    text: t.trim()
  })).filter(s => s.text.length > 0);

  const manifest = {
    id,
    title,
    license,
    uploader: argv.uploader || null,
    source_filename: path.basename(file),
    version,
    sections: rawSections
  };

  // fail closed: require license metadata
  if (!manifest.license) { console.error('license metadata required'); process.exit(4); }

  const outDir = path.join('data', 'approved-sources', 'drafts');
  fs.mkdirSync(outDir, { recursive: true });
  const manifestPath = path.join(outDir, `${id}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Wrote manifest to', manifestPath);

  // produce chunks using chunker module directly (no shell)
  const chunksOutDir = path.join('data', 'approved-chunks', 'drafts');
  fs.mkdirSync(chunksOutDir, { recursive: true });
  const chunksPath = path.join(chunksOutDir, `${id}-chunks.json`);

  try {
    const result = buildChunksFromManifest(manifest, { });
    writeChunks(chunksPath, result);
    console.log('Chunks written to', chunksPath);
  } catch (err) {
    console.error('Chunker failed:', err.message);
    process.exit(5);
  }
}

module.exports = { stripHtml };
