import fs from 'fs';
import path from 'path';

/*
 * Design-token consolidation contract (Phase 1).
 *
 * Locks the canonical token architecture established in theme/tokens.css so a
 * future change cannot silently reintroduce a competing token source or make
 * the dark variant non-opt-in.
 *
 * Scope note: this is a token-contract guard, not a visual/contrast test.
 * WCAG 2.2 AA contrast for the dark variant must still be validated in a
 * browser before any page opts into [data-theme="dark"].
 */
describe('design token consolidation contract', () => {
  const rootDir = process.cwd();
  const tokens = fs.readFileSync(path.join(rootDir, 'theme', 'tokens.css'), 'utf8');

  it('defines the canonical light tokens in theme/tokens.css', () => {
    expect(tokens).toMatch(/--tm-bg\s*:/);
    expect(tokens).toMatch(/--tm-surface\s*:/);
    expect(tokens).toMatch(/--tm-text\s*:/);
    expect(tokens).toMatch(/--tm-primary\s*:/);
    expect(tokens).toMatch(/--tm-accent\s*:/);
    expect(tokens).toMatch(/--tm-success\s*:/);
    expect(tokens).toMatch(/--tm-danger\s*:/);
  });

  it('exposes dark surfaces as an explicit opt-in variant', () => {
    // Dark tokens must be scoped to the variant selector, never the bare :root,
    // so the light theme remains the default and dark is deliberate.
    expect(tokens).toMatch(/:root\[data-theme="dark"\]\s*\{/);
  });

  it('keeps the dark variant additive (no shipped page opts in yet)', () => {
    // The dark variant is provided but not yet applied, so consolidation does
    // not change any current page rendering. If a page intentionally opts in
    // later, update this test deliberately alongside that change.
    const htmlFiles = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.html')) htmlFiles.push(full);
      }
    };
    walk(rootDir);

    const optedIn = htmlFiles.filter((file) =>
      fs.readFileSync(file, 'utf8').includes('data-theme="dark"')
    );
    expect(optedIn).toEqual([]);
  });
});
