import fs from 'node:fs';

describe('Ollama configuration consistency', () => {
  test('staging contains the canonical Ollama Cloud configuration lines', () => {
    const raw = fs.readFileSync('wrangler.jsonc', 'utf8');
    // Check for expected canonical var lines in the staging.vars block
    expect(raw).toContain('"TORQUEMIND_AI_PROVIDER": "ollama"');
    expect(raw).toContain('"TORQUEMIND_AI_URL": "https://ollama.com/api/chat"');
    expect(raw).toContain('"TORQUEMIND_AI_MODEL": "gpt-oss:20b-cloud"');
    expect(raw).toContain('"TORQUEMIND_AI_TIMEOUT_MS": "60000"');
  });

  test('no secret is stored in Wrangler vars', () => {
    const raw = fs.readFileSync('wrangler.jsonc', 'utf8');
    // Ensure no plain-text secret keys are present in vars
    expect(raw).not.toContain('TORQUEMIND_AI_API_KEY');
    expect(raw).not.toContain('OLLAMA_API_KEY');
  });
});
