'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const registry = JSON.parse(
  fs.readFileSync(path.join(root, 'data/evidence/external-technical-references.json'), 'utf8')
);
const sourceState = JSON.parse(
  fs.readFileSync(path.join(root, 'data/evidence/source-state-registry.json'), 'utf8')
);

describe('external technical reference contract', () => {
  test('all vendor records are citation-only and non-ingestible', () => {
    for (const source of registry.sources) {
      expect(source.evidence_role).toBe('external-technical-reference');
      expect(source.citation_allowed).toBe(true);
      expect(source.ollama_eligible).toBe(false);
      expect(source.reusable_chunks_allowed).toBe(false);
      expect(source.transcript_ingestion_allowed).toBe(false);
      expect(source.figures_reuse_allowed).toBe(false);
    }
  });

  test('every source has stable locator-based claim support', () => {
    for (const source of registry.sources) {
      expect(source.canonical_url.startsWith('https://')).toBe(true);
      expect(source.references.length).toBeGreaterThan(0);
      for (const ref of source.references) {
        expect(ref.locator.trim().length).toBeGreaterThan(0);
        expect(ref.supports_claim.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('vendor references contain no stored excerpts or quotations', () => {
    const serialized = JSON.stringify(registry);
    expect(serialized).not.toContain('"text_excerpt"');
    expect(serialized).not.toContain('"permitted_excerpt"');
    expect(serialized).not.toContain('"excerpt"');
    expect(serialized).not.toContain('"quote"');
  });

  test('external references cannot collide with canonical evidence sources', () => {
    const canonical = new Set(sourceState.sources.map((source) => source.source_id));
    for (const source of registry.sources) {
      expect(canonical.has(source.source_id)).toBe(false);
    }
  });

  test('current registry includes multiple independent supplier authorities', () => {
    const vendors = new Set(registry.sources.map((source) => source.vendor));
    expect(vendors.has('Robert Bosch GmbH')).toBe(true);
    expect(vendors.has('HELLA')).toBe(true);
    expect(vendors.has('DENSO')).toBe(true);
    expect(vendors.has('Delco Remy / PHINIA')).toBe(true);
    expect(vendors.has('Valeo Service')).toBe(true);
  });
});
