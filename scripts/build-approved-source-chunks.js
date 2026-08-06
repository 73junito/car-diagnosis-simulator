#!/usr/bin/env node
/*
  Simple chunking utility for approved sources.
  This script expects a JSON manifest of a source with sections and will emit chunk records.
  It's intentionally small — replace with production-grade chunker as needed.
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TARGET_TOKENS = 3500;
const MAX_TOKENS = 6000;
const MIN_TOKENS = 800;
const OVERLAP_TOKENS = 400;

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function approximateTokenCount(text) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function splitAtStructure(sections) {
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

function buildChunk(source, groupedSections, index) {
  const text = groupedSections.map(s => s.text.trim()).filter(Boolean).join('\n\n');
  const first = groupedSections[0];
  const last = groupedSections[groupedSections.length - 1];

  return {
    chunk_id: `${source.id}-chunk-${String(index + 1).padStart(4, '0')}`,
    source_id: source.id,
    source_version: source.version || 1,
    title: first.chapterTitle || source.title || null,
    section: first.sectionTitle || null,
    page_start: first.page || null,
    page_end: last.page || first.page || null,
    locator: [first.chapterTitle, first.sectionTitle].filter(Boolean).join(' > ') || null,
    text_excerpt: text,
    token_count: approximateTokenCount(text),
    overlap_before_tokens: OVERLAP_TOKENS,
    overlap_after_tokens: OVERLAP_TOKENS,
    text_hash: sha256(text),
    status: 'draft',
    approved: false,
    created_at: new Date().toISOString()
  };
}

function chunkSource(inputPath, outPath) {
  const src = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const sections = src.sections || [];
  const grouped = splitAtStructure(sections);
  const chunks = grouped.map((g, i) => buildChunk(src, g, i));
  fs.writeFileSync(outPath, JSON.stringify({ source: { id: src.id, title: src.title }, chunks }, null, 2), 'utf8');
  console.log(`Wrote ${chunks.length} chunks to ${outPath}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: build-approved-source-chunks <source-manifest.json> <out.json>');
    process.exit(2);
  }

  chunkSource(args[0], args[1]);
}
