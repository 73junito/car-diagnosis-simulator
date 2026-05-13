import fs from 'fs';
import path from 'path';

describe('HERO-002 smooth scroll wiring', () => {
  const rootDir = process.cwd();
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const themeCss = fs.readFileSync(path.join(rootDir, 'theme.css'), 'utf8');

  it('wires nav scenarios anchor to an existing #scenarios section', () => {
    expect(indexHtml).toContain('href="#scenarios"');
    expect(indexHtml).toContain('id="scenarios"');
  });

  it('enables smooth scrolling globally with reduced-motion fallback', () => {
    expect(themeCss).toMatch(/html\s*\{\s*scroll-behavior\s*:\s*smooth\s*}/);
    expect(themeCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*html\s*\{\s*scroll-behavior\s*:\s*auto\s*}/);
  });
});
