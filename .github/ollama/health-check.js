#!/usr/bin/env node

const http = require('http');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

const REQUIRED_MODELS = [
  'qwen3:30b',
  'qwen2.5-coder:7b',
  'gemma2:2b',
  'phi3:mini',
  'llama3.1:8b',
  'qwen3.5:9b',
  'qwen3-embedding:8b',
  'all-minilm:22m',
  'deepseek-coder:6.7b-instruct',
  'starcoder2:7b',
];

function requestJson(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, OLLAMA_HOST);

    const req = http.get(url, res => {
      let body = '';

      res.on('data', chunk => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid JSON from Ollama: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error('Ollama request timed out'));
    });
  });
}

async function main() {
  console.log(`Checking Ollama at ${OLLAMA_HOST}\n`);

  let data;

  try {
    data = await requestJson('/api/tags');
  } catch (error) {
    console.error('Ollama health check failed.');
    console.error(`Reason: ${error.message}`);
    console.error('\nStart Ollama with:');
    console.error('ollama serve');
    process.exit(1);
  }

  const installed = new Set((data.models || []).map(model => model.name));
  const missing = [];

  for (const model of REQUIRED_MODELS) {
    if (installed.has(model)) {
      console.log(`✓ ${model}`);
    } else {
      console.log(`✗ ${model}`);
      missing.push(model);
    }
  }

  if (missing.length > 0) {
    console.error('\nMissing models:');
    for (const model of missing) {
      console.error(`ollama pull ${model}`);
    }

    process.exit(1);
  }

  console.log('\nAll required Ollama models are available.');
}

main();