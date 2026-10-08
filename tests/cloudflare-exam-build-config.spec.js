const fs = require('fs');
const path = require('path');

describe('Cloudflare exam build configuration contract', () => {
  const repoRoot = path.join(__dirname, '..');
  const examConfig = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'wrangler.exam.jsonc'), 'utf8')
  );
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );

  test('prepares exam assets through the exam Wrangler config', () => {
    expect(examConfig.name).toBe('autolearnpro-exam');
    expect(examConfig.assets.directory).toBe('./exam-site');
    expect(examConfig.build).toEqual({ command: 'npm run exam:prepare' });
  });

  test('uses explicit exam config for production and Worker Previews', () => {
    expect(pkg.scripts['cloudflare:exam:deploy']).toBe(
      'wrangler deploy --config wrangler.exam.jsonc'
    );
    expect(pkg.scripts['cloudflare:exam:preview']).toBe(
      'wrangler preview --config wrangler.exam.jsonc'
    );
  });
});
