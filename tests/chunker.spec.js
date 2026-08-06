const fs = require('fs');
const path = require('path');
const child = require('child_process');

const runner = path.join(__dirname, '..', 'scripts', 'build-approved-source-chunks.js');
const ingest = path.join(__dirname, '..', 'scripts', 'ingest-approved-source.js');

describe('approved source chunker', () => {
  const tmp = path.join(__dirname, 'tmp-chunker');
  beforeAll(() => { if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true }); });
  afterAll(() => {
    try { fs.rmSync(tmp, { recursive: true }); } catch (e) {}
  });

  test('rejects invalid manifest', () => {
    const bad = { title: 'no id' };
    const inPath = path.join(tmp, 'bad.json');
    fs.writeFileSync(inPath, JSON.stringify(bad));
    expect(() => child.execSync(`node ${runner} ${inPath} ${path.join(tmp,'out.json')}`)).toThrow();
  });

  test('deterministic output and idempotent write', () => {
    const manifest = {
      id: 'test-src',
      title: 'Test Source',
      license: 'CC-BY',
      sections: [ { text: 'A'.repeat(2000) }, { text: 'B'.repeat(2000) } ]
    };
    const inPath = path.join(tmp, 'test.json');
    const outPath = path.join(tmp, 'test-chunks.json');
    fs.writeFileSync(inPath, JSON.stringify(manifest));

    child.execSync(`node ${runner} ${inPath} ${outPath}`);
    const first = fs.readFileSync(outPath, 'utf8');
    child.execSync(`node ${runner} ${inPath} ${outPath}`);
    const second = fs.readFileSync(outPath, 'utf8');
    expect(first).toEqual(second);
  });

  test('ingest creates manifest and chunks (draft-only)', () => {
    const content = 'Hello world\n\nThis is a test document.';
    const filePath = path.join(tmp, 'doc.txt');
    fs.writeFileSync(filePath, content);
    const cmd = `node ${ingest} --file ${filePath} --id ingest1 --title "Ingest 1" --license "CC-BY"`;
    const out = child.execSync(cmd).toString();
    expect(out).toMatch(/Wrote manifest/);
    const manifestPath = path.join('data', 'approved-sources', 'drafts', 'ingest1.json');
    const chunkPath = path.join('data', 'approved-chunks', 'drafts', 'ingest1-chunks.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(chunkPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.license).toBe('CC-BY');
    const chunks = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
    expect(Array.isArray(chunks.chunks)).toBe(true);
  });
});
