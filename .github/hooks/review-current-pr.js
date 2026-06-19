#!/usr/bin/env node

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'reports');
const OUT_FILE = path.join(OUT_DIR, 'local-pr-review.md');

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function getModel(task) {
  try {
    return run('node', ['.github/ollama/select-model.js', task]);
  } catch {
    return 'qwen2.5-coder:7b';
  }
}

function getDiff() {
  try {
    return run('git', ['diff', '--staged']);
  } catch {
    return '';
  }
}

function getFallbackDiff() {
  try {
    return run('git', ['diff', 'main...HEAD']);
  } catch {
    return run('git', ['diff']);
  }
}

function callOllama(model, prompt) {
  const result = spawnSync('ollama', ['run', model], {
    cwd: ROOT,
    input: prompt,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || `ollama exited with code ${result.status}`);
  }

  return result.stdout.trim();
}

function main() {
  const model = getModel('code_review');
  let diff = getDiff();

  if (!diff) {
    diff = getFallbackDiff();
  }

  if (!diff) {
    console.log('No diff found to review.');
    process.exit(0);
  }

  const prompt = `
You are reviewing a pull request for the Car Diagnosis Simulator repository.

Focus on:
- correctness
- test risk
- Playwright reliability
- GitHub Actions impact
- security concerns
- maintainability
- accidental generated files
- Windows + Linux compatibility

Return markdown with:
1. Summary
2. High-risk issues
3. Required fixes
4. Suggested improvements
5. Test recommendations

Diff:
\`\`\`diff
${diff.slice(0, 120000)}
\`\`\`
`;

  console.log(`Running local PR review with ${model}...`);

  const review = callOllama(model, prompt);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, review + '\n', 'utf8');

  console.log(`Review written to ${OUT_FILE}`);
}

main();