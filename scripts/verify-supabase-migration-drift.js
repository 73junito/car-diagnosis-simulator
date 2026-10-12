#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MIGRATION_RE = /^(\d{14})_(.+)\.sql$/;

function parseMigrationPath(file) {
  const base = path.basename(file);
  const match = base.match(MIGRATION_RE);
  if (!match) return null;
  return { version: match[1], name: match[2], file: file.replace(/\\/g, '/') };
}

function readMigrationContent(ref, file) {
  if (ref === 'WORKTREE') return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  return execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8' });
}

function canonicalRepositoryMigrations(ref = 'WORKTREE') {
  let files;
  if (ref === 'WORKTREE') {
    const dir = path.join(process.cwd(), 'supabase', 'migrations');
    files = fs.readdirSync(dir).map((name) => `supabase/migrations/${name}`);
  } else {
    const output = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', 'supabase/migrations'], { encoding: 'utf8' });
    files = output.split(/\r?\n/).filter(Boolean);
  }

  const seenHashes = new Set();
  const ignoredBloat = [];
  const migrations = [];

  for (const file of files.map(parseMigrationPath).filter(Boolean).sort((a, b) => a.version.localeCompare(b.version))) {
    const content = readMigrationContent(ref, file.file);
    if (!content.trim()) {
      ignoredBloat.push({ ...file, reason: 'empty' });
      continue;
    }
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    if (seenHashes.has(hash)) {
      ignoredBloat.push({ ...file, reason: 'duplicate-content', hash });
      continue;
    }
    seenHashes.add(hash);
    migrations.push({ ...file, hash });
  }

  return { migrations, ignoredBloat };
}

function compareMigrationHistories(repository, remote) {
  const repoKeys = new Set(repository.map((x) => `${x.version}:${x.name}`));
  const remoteKeys = new Set(remote.map((x) => `${x.version}:${x.name}`));

  const missing = repository.filter((x) => !remoteKeys.has(`${x.version}:${x.name}`));
  const extra = remote.filter((x) => !repoKeys.has(`${x.version}:${x.name}`));

  const timestampAliases = [];
  const missingByName = new Map();
  for (const item of missing) {
    const a = missingByName.get(item.name) || [];
    a.push(item.version);
    missingByName.set(item.name, a);
  }
  const extraByName = new Map();
  for (const item of extra) {
    const a = extraByName.get(item.name) || [];
    a.push(item.version);
    extraByName.set(item.name, a);
  }
  for (const [name, repoVersions] of missingByName) {
    const remoteVersions = extraByName.get(name);
    if (remoteVersions?.length) {
      timestampAliases.push({
        name,
        repository: repoVersions.sort(),
        remote: remoteVersions.sort()
      });
    }
  }

  return { missing, extra, timestampAliases };
}

function repositoryMigrations(ref = 'WORKTREE') {
  return canonicalRepositoryMigrations(ref).migrations;
}

function projectRefFromUrl(raw) {
  const parsed = new URL(raw);
  const match = parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
  return match ? match[1] : null;
}

async function remoteMigrations(url, serviceRoleKey) {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/app_migration_history`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Migration history RPC failed (${response.status}): ${text.slice(0, 300)}`);
  const rows = JSON.parse(text);
  if (!Array.isArray(rows)) throw new Error('Migration history RPC returned a non-array response.');
  return rows.map((row) => ({ version: String(row.version || ''), name: String(row.name || '') }));
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main() {
  const ref = arg('--ref', 'WORKTREE');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const expectedRef = process.env.EXPECTED_SUPABASE_REF;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

  const actualRef = projectRefFromUrl(url);
  if (!actualRef || (expectedRef && actualRef !== expectedRef)) {
    throw new Error(`Supabase project mismatch: expected ${expectedRef || 'a valid project ref'}, got ${actualRef || 'invalid URL'}.`);
  }

  const { migrations: repository, ignoredBloat } = canonicalRepositoryMigrations(ref);
  const remote = await remoteMigrations(url, key);
  const result = compareMigrationHistories(repository, remote);

  console.log(`Repository canonical baseline (${ref}): ${repository.length} migrations.`);
  if (ignoredBloat.length) {
    console.log(`Ignored repository migration bloat: ${ignoredBloat.length} file(s).`);
    for (const item of ignoredBloat) console.log(`  ~ ${item.version}_${item.name}.sql (${item.reason})`);
  }
  console.log(`Remote ${actualRef}: ${remote.length} migrations.`);

  if (result.timestampAliases.length) {
    console.error(`FAIL: timestamp-renamed migrations detected: ${result.timestampAliases.length}.`);
    for (const alias of result.timestampAliases) {
      console.error(`  ~ ${alias.name}: repo=${alias.repository.join(',')} remote=${alias.remote.join(',')}`);
    }
  }
  if (result.extra.length) {
    console.error(`FAIL: remote-only migration records: ${result.extra.length}.`);
    for (const item of result.extra) console.error(`  + ${item.version}_${item.name}`);
  }
  if (result.missing.length) {
    console.error(`FAIL: remote is missing ${result.missing.length} canonical migration(s):`);
    for (const item of result.missing) console.error(`  - ${item.version}_${item.name}.sql`);
  }

  if (result.missing.length || result.extra.length || result.timestampAliases.length) {
    process.exitCode = 1;
    return;
  }
  console.log('PASS: remote migration history exactly matches the canonical repository baseline.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseMigrationPath,
  compareMigrationHistories,
  canonicalRepositoryMigrations,
  repositoryMigrations,
  projectRefFromUrl
};
