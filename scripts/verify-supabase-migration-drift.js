#!/usr/bin/env node
'use strict';

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

function countByName(items) {
  const counts = new Map();
  for (const item of items) counts.set(item.name, (counts.get(item.name) || 0) + 1);
  return counts;
}

function compareMigrationHistories(repository, remote, exceptions = {}) {
  const repoCounts = countByName(repository);
  const remoteCounts = countByName(remote);
  const missing = [];
  const extra = [];
  const timestampAliases = []
  const exceptionsUsed = [];

  for (const [name, count] of repoCounts) {
    const remoteCount = remoteCounts.get(name) || 0;
    if (remoteCount < count) {
      const configured = Number(exceptions[name]?.allowedMissing || 0)
      const deficit = count - remoteCount
      const exempted = Math.min(deficit, Math.max(0, configured))
      if (exempted > 0) {
        exceptionsUsed.push({ name, count: exempted, ...exceptions[name] })
      }
      let remaining = deficit - exempted
      for (const item of repository.filter((entry) => entry.name === name).reverse()) {
        if (!remaining) break
        missing.unshift(item)
        remaining -= 1
      }
    }
  }

  for (const [name, count] of remoteCounts) {
    const repoCount = repoCounts.get(name) || 0;
    if (count > repoCount) {
      extra.push({ name, count: count - repoCount });
    }
  }

  for (const name of repoCounts.keys()) {
    if ((repoCounts.get(name) || 0) !== (remoteCounts.get(name) || 0)) continue;
    const repoVersions = repository.filter((x) => x.name === name).map((x) => x.version).sort();
    const remoteVersions = remote.filter((x) => x.name === name).map((x) => x.version).sort();
    if (JSON.stringify(repoVersions) !== JSON.stringify(remoteVersions)) {
      timestampAliases.push({ name, repository: repoVersions, remote: remoteVersions });
    }
  }

  return { missing, extra, timestampAliases, exceptionsUsed };
}

function repositoryMigrations(ref = 'WORKTREE') {
  let files;
  if (ref === 'WORKTREE') {
    const dir = path.join(process.cwd(), 'supabase', 'migrations');
    files = fs.readdirSync(dir).map((name) => `supabase/migrations/${name}`);
  } else {
    const output = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', 'supabase/migrations'], { encoding: 'utf8' });
    files = output.split(/\r?\n/).filter(Boolean);
  }
  return files.map(parseMigrationPath).filter(Boolean).sort((a, b) => a.version.localeCompare(b.version));
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

  const repository = repositoryMigrations(ref)
  const remote = await remoteMigrations(url, key)
  const exceptionPath = path.join(process.cwd(), 'supabase', 'migration-drift-exceptions.json')
  const exceptionDocument = fs.existsSync(exceptionPath) ? JSON.parse(fs.readFileSync(exceptionPath, 'utf8')) : {}
  const exceptions = exceptionDocument[actualRef] || {}
  const result = compareMigrationHistories(repository, remote, exceptions)

  console.log(`Repository baseline (${ref}): ${repository.length} migrations.`);
  console.log(`Remote ${actualRef}: ${remote.length} migrations.`);
  if (result.timestampAliases.length) {
    console.log(`Timestamp aliases accepted: ${result.timestampAliases.length}.`);
    for (const alias of result.timestampAliases) {
      console.log(`  ~ ${alias.name}: repo=${alias.repository.join(',')} remote=${alias.remote.join(',')}`);
    }
  }
  if (result.exceptionsUsed.length) {
    console.warn(`Approved missing-migration exceptions used: ${result.exceptionsUsed.length}.`)
    for (const item of result.exceptionsUsed) console.warn(`  ! ${item.name} x${item.count}: ${item.reason}`)
  }
  if (result.extra.length) {
    console.warn(`Remote-only logical migrations: ${result.extra.length}.`);
    for (const item of result.extra) console.warn(`  + ${item.name} x${item.count}`);
  }
  if (result.missing.length) {
    console.error(`FAIL: remote is missing ${result.missing.length} canonical logical migration(s):`);
    for (const item of result.missing) console.error(`  - ${item.version}_${item.name}.sql`);
    process.exitCode = 1;
    return;
  }
  console.log('PASS: remote contains every canonical logical migration in the selected repository baseline.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { parseMigrationPath, compareMigrationHistories, repositoryMigrations, projectRefFromUrl };
