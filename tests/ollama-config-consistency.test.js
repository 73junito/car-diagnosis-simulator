const fs = require('node:fs');
const path = require('node:path');

describe('Ollama configuration consistency', () => {
  test('staging contains the protected Ollama gateway configuration', () => {
    const configPath = path.resolve(__dirname, '..', 'wrangler.jsonc');
    const raw = fs.readFileSync(configPath, 'utf8');

    expect(raw).toContain('"TORQUEMIND_AI_PROVIDER": "ollama"');
    expect(raw).toContain(
      '"TORQUEMIND_AI_URL": "https://ollama.autolearnpro.com/api/chat"'
    );
    expect(raw).toContain('"TORQUEMIND_AI_MODEL": "gpt-oss:20b-cloud"');
    expect(raw).toContain('"TORQUEMIND_AI_TIMEOUT_MS": "120000"');
  });
});
