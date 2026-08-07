const fs = require('fs');
const path = require('path');

const runner = path.join(__dirname, '..', 'scripts', 'build-approved-source-chunks.js');
const ingest = path.join(__dirname, '..', 'scripts', 'ingest-approved-source.js');
const { spawnSync } = require('child_process');

function runNodeScript(scriptPath, args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8', shell: false, windowsHide: true });
}

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
    const outPath = path.join(tmp, 'out.json');
    const result = runNodeScript(runner, [inPath, outPath]);
    expect(result.status).not.toBe(0);
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

    const r1 = runNodeScript(runner, [inPath, outPath]);
    expect(r1.status).toBe(0);
    expect(r1.stderr).toBe('');
    const first = fs.readFileSync(outPath, 'utf8');
    const r2 = runNodeScript(runner, [inPath, outPath]);
    expect(r2.status).toBe(0);
    expect(r2.stderr).toBe('');
    const second = fs.readFileSync(outPath, 'utf8');
    expect(first).toEqual(second);
  });

  test('ingest creates manifest and chunks (draft-only)', () => {
    const content = 'Hello world\n\nThis is a test document.';
    const filePath = path.join(tmp, 'doc.txt');
    fs.writeFileSync(filePath, content);
    const res = runNodeScript(ingest, ['--file', filePath, '--id', 'ingest1', '--title', 'Ingest 1', '--license', 'CC-BY']);
    expect(res.status).toBe(0);
    expect(res.stderr).toBe('');
    expect(res.stdout).toMatch(/Wrote manifest/);
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
