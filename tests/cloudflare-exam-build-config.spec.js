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

  test('keeps the exam Wrangler config to runtime and assets only', () => {
    expect(examConfig.name).toBe('autolearnpro-exam');
    expect(examConfig.assets.directory).toBe('./exam-site');
    expect(examConfig.build).toBeUndefined();
  });

  test('uses explicit exam config for production and Worker Previews', () => {
    expect(pkg.scripts['cloudflare:exam:deploy']).toBe(
      'npm run exam:prepare && wrangler deploy --config wrangler.exam.jsonc'
    );
    expect(pkg.scripts['cloudflare:exam:preview']).toBe(
      'npm run exam:prepare && wrangler preview --config wrangler.exam.jsonc'
    );
  });
});
