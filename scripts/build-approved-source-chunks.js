#!/usr/bin/env node
/*
  Hardened chunking utility for approved sources.
  - CLI with flags
  - manifest validation
  - deterministic chunk ids (sha256)
  - idempotent output (won't rewrite identical file)
  - overlap tokens saved as excerpt slices
  - preview mode
  - fails closed on malformed metadata
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULTS = {
  TARGET_TOKENS: 3500,
  MAX_TOKENS: 6000,
  MIN_TOKENS: 800,
  OVERLAP_TOKENS: 400
};

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function approximateTokenCount(text) {
  return Math.max(1, Math.ceil(text.replace(/\s+/g, ' ').trim().length / 4));
}

function validateManifest(src) {
  if (!src || typeof src !== 'object') throw new Error('manifest must be a JSON object');
  if (!src.id || typeof src.id !== 'string') throw new Error('manifest.id is required and must be a string');
  if (!src.title || typeof src.title !== 'string') throw new Error('manifest.title is required and must be a string');
  if (!src.license || typeof src.license !== 'string') throw new Error('manifest.license is required and must be a string');
  if (!Array.isArray(src.sections)) throw new Error('manifest.sections must be an array');
  // each section must have text
  for (const [i, s] of src.sections.entries()) {
    if (!s || typeof s.text !== 'string' || s.text.trim().length === 0) throw new Error(`manifest.sections[${i}].text is required`);
  }
}

function splitAtStructure(sections, opts) {
  const { MAX_TOKENS } = opts;
  const chunks = [];
  let current = [];

  for (const section of sections) {
    const candidate = [...current, section];
    const candidateText = candidate.map(item => item.text).join('\n\n');
    const tokens = approximateTokenCount(candidateText);

    if (tokens > MAX_TOKENS && current.length > 0) {
      chunks.push(current);
      current = [section];
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

function joinText(sections) {
  return sections.map(s => s.text.trim()).filter(Boolean).join('\n\n');
}

function tokenSliceText(text, startTokens, lengthTokens) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const slice = tokens.slice(startTokens, startTokens + lengthTokens).join(' ');
  return slice;
}

function buildChunkRecord(source, groupedSections, opts) {
  const text = joinText(groupedSections);
  const textHash = sha256(text);
  const deterministicId = sha256(`${source.id}:${textHash}`).slice(0, 32);
  const first = groupedSections[0];
  const last = groupedSections[groupedSections.length - 1];
  const tokenCount = approximateTokenCount(text);

  // compute actual overlap text snippets for provenance
  const beforeOverlap = tokenSliceText(text, Math.max(0, tokenCount - opts.OVERLAP_TOKENS), opts.OVERLAP_TOKENS);
  const afterOverlap = tokenSliceText(text, 0, Math.min(opts.OVERLAP_TOKENS, tokenCount));

  return {
    chunk_id: `ch_${deterministicId}`,
    source_id: source.id,
    source_version: source.version || 1,
    title: first.chapterTitle || source.title || null,
    section: first.sectionTitle || null,
    page_start: first.page || null,
    page_end: last.page || first.page || null,
    locator: [first.chapterTitle, first.sectionTitle].filter(Boolean).join(' > ') || null,
    text_excerpt: text,
    token_count: tokenCount,
    overlap_before_text: beforeOverlap || null,
    overlap_after_text: afterOverlap || null,
    overlap_before_tokens: opts.OVERLAP_TOKENS,
    overlap_after_tokens: opts.OVERLAP_TOKENS,
    text_hash: textHash,
    status: 'draft',
    approved: false,
    // deterministic created_at so repeated runs produce identical output
    created_at: new Date(0).toISOString()
  };
}

function writeIfChanged(filePath, obj) {
  const newJson = JSON.stringify(obj, null, 2);
  if (fs.existsSync(filePath)) {
    const old = fs.readFileSync(filePath, 'utf8');
    if (old === newJson) {
      console.log(`Unchanged: ${filePath}`);
      return false;
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, newJson, 'utf8');
  return true;
}

function buildChunksFromManifest(src, opts) {
  validateManifest(src);
  const sections = src.sections || [];
  const grouped = splitAtStructure(sections, opts);
  const chunks = grouped.map(g => buildChunkRecord(src, g, opts));
  return { source: { id: src.id, title: src.title, version: src.version || 1 }, chunks };
}

function writeChunks(outPath, outObj) {
  const changed = writeIfChanged(outPath, outObj);
  console.log(`${changed ? 'Wrote' : 'Left unchanged'} ${outObj.chunks.length} chunks to ${outPath}`);
  return changed;
}

function previewChunks(outObj) {
  const counts = outObj.chunks.length;
  const tokens = outObj.chunks.map(c => c.token_count);
  const dupHashes = findDuplicates(outObj.chunks.map(c => c.text_hash));
  const oversized = outObj.chunks.filter(c => c.token_count > DEFAULTS.MAX_TOKENS);
  return { chunk_count: counts, token_min: Math.min(...tokens), token_max: Math.max(...tokens), dup_hashes: dupHashes, oversized: oversized.length };
}

function findDuplicates(arr) {
  const seen = new Map();
  for (const a of arr) seen.set(a, (seen.get(a) || 0) + 1);
  return [...seen.entries()].filter(([, v]) => v > 1).map(([k]) => k);
}

if (require.main === module) {
  const argv = require('minimist')(process.argv.slice(2), { boolean: ['preview', 'force'], alias: { o: 'out', p: 'preview' } });
  const input = argv._[0];
  const out = argv.out || argv._[1];
  if (!input) {
    console.error('Usage: build-approved-source-chunks <source-manifest.json> [out.json] [--preview] [--force]');
    process.exit(2);
  }

  const inJson = JSON.parse(fs.readFileSync(input, 'utf8'));
  const opts = Object.assign({}, DEFAULTS, {
    TARGET_TOKENS: Number(argv.target || DEFAULTS.TARGET_TOKENS),
    MAX_TOKENS: Number(argv.max || DEFAULTS.MAX_TOKENS),
    MIN_TOKENS: Number(argv.min || DEFAULTS.MIN_TOKENS),
    OVERLAP_TOKENS: Number(argv.overlap || DEFAULTS.OVERLAP_TOKENS)
  });

  try {
    const outPath = out || path.join(path.dirname(input), `${inJson.id || inJson.title}-chunks.json`);
    const result = buildChunksFromManifest(inJson, opts);
    writeChunks(outPath, result);
    if (argv.preview) {
      console.log('Preview:', JSON.stringify(previewChunks(result), null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(3);
  }
}

module.exports = { buildChunksFromManifest, writeChunks, validateManifest };
