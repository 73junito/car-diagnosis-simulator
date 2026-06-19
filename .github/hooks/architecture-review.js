#!/usr/bin/env node

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT_FILE = path.join(ROOT, 'docs', 'architecture-review.md');

const INCLUDE_DIRS = [
  'api',
  'core',
  'dashboard',
  'data',
  'docs',
  'engine',
  'js',
  'lib',
  'scripts',
  'services',
  'tests',
  '.github',
];

const INCLUDE_EXTENSIONS = new Set([
  '.js',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.html',
  '.css',
]);

const EXCLUDE_PARTS = [
  'node_modules',
  '.git',
  'playwright-report',
  'test-results',
  '.checkpoints',
  'coverage',
  'dist',
  'build',
];

function run(command, args) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function getModel(task) {
  try {
    return run('node', ['.github/ollama/select-model.js', task]);
  } catch {
    return 'qwen3:30b';
  }
}

function shouldExclude(filePath) {
  return EXCLUDE_PARTS.some(part => filePath.includes(part));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT, fullPath);

    if (shouldExclude(relPath)) continue;

    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (INCLUDE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(relPath);
    }
  }

  return files;
}

function collectProjectMap() {
  const files = [];

  for (const dir of INCLUDE_DIRS) {
    walk(path.join(ROOT, dir), files);
  }

  return files.sort();
}

function readImportantFiles(files) {
  const important = files.filter(file =>
    /(^package\.json$|README\.md$|\.github[\\/]|core[\\/]|lib[\\/]|services[\\/]|scripts[\\/]|tests[\\/])/.test(file)
  );

  const chunks = [];

  for (const file of important.slice(0, 120)) {
    try {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
      chunks.push(`\n--- FILE: ${file} ---\n${text.slice(0, 6000)}`);
    } catch {
      // Ignore unreadable files.
    }
  }

  return chunks.join('\n');
}

function callOllama(model, prompt) {
  const result = spawnSync('ollama', ['run', model], {
    cwd: ROOT,
    input: prompt,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 30,
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
  const model = getModel('architecture');
  const files = collectProjectMap();
  const importantContent = readImportantFiles(files);

  const prompt = `
You are the architecture reviewer for the Car Diagnosis Simulator repository.

Review the project structure and provide a practical architecture report.

Focus on:
- system boundaries
- test architecture
- CI/CD reliability
- local Ollama agent framework
- dashboard/frontend structure
- worker/checkpoint/diagnosis core modules
- maintainability risks
- missing abstractions
- recommended next PRs

Return markdown with these sections:
1. Executive Summary
2. Current Architecture Map
3. Strengths
4. Risks
5. Recommended Folder Improvements
6. Recommended CI Improvements
7. Recommended Local Ollama Agent Improvements
8. Next 5 Pull Requests

Project files:
\`\`\`text
${files.join('\n').slice(0, 50000)}
\`\`\`

Important file excerpts:
\`\`\`text
${importantContent.slice(0, 120000)}
\`\`\`
`;

  console.log(`Running architecture review with ${model}...`);

  const report = callOllama(model, prompt);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, report + '\n', 'utf8');

  console.log(`Architecture review written to ${OUT_FILE}`);
}

main();