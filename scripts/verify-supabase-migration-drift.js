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
  return execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
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

/**
 * Decides whether the recorded migration history and the materialized schema agree.
 *
 * Pure function: no I/O, no network. It guards the failure mode described in
 * issue #1072: recording a migration version in history must never be used as a
 * substitute for actually applying the SQL, and history must not be "repaired"
 * while the materialized schema is still stale.
 *
 * @param {object} input
 * @param {Array<{version:string,name:string}>} input.history recorded migration history
 * @param {object|null} input.schemaProbe observed materialized state for the target migration
 * @param {string} input.version target migration version
 * @param {{pre:object, post:object}} input.expected expected probe states
 */
function evaluateApplicationGate({ history, schemaProbe, version, expected }) {
  const target = String(version || '');
  const recordedInHistory = (history || []).some((row) => String(row.version) === target);
  const probe = schemaProbe || null;

  const matches = (state) => {
    if (!probe) return false;
    return Object.keys(state || {}).every((key) => {
      return JSON.stringify(probe[key]) === JSON.stringify(state[key]);
    });
  };

  const schemaMatchesPre = matches((expected || {}).pre);
  const schemaMatchesPost = matches((expected || {}).post);

  if (recordedInHistory && schemaMatchesPost) {
    return {
      decision: 'already_applied',
      ok: true,
      recordedInHistory,
      schemaMatchesPre,
      schemaMatchesPost,
      requiresTrackedApplication: false,
      reason: `version ${target} is recorded and the materialized schema matches the expected post-state`
    };
  }
  if (recordedInHistory && schemaMatchesPre) {
    return {
      decision: 'history_recorded_but_schema_stale',
      ok: false,
      recordedInHistory,
      schemaMatchesPre,
      schemaMatchesPost,
      requiresTrackedApplication: true,
      reason: `version ${target} is recorded in history but the materialized schema is still the pre-state; apply the canonical SQL through the tracked migration process instead of repairing history`
    };
  }
  if (!recordedInHistory && schemaMatchesPost) {
    return {
      decision: 'schema_applied_but_history_missing',
      ok: false,
      recordedInHistory,
      schemaMatchesPre,
      schemaMatchesPost,
      requiresTrackedApplication: true,
      reason: `the materialized schema already shows the post-state but version ${target} is not recorded; reconcile history only with evidence of the original tracked application`
    };
  }
  if (!recordedInHistory && schemaMatchesPre) {
    return {
      decision: 'apply_required',
      ok: true,
      recordedInHistory,
      schemaMatchesPre,
      schemaMatchesPost,
      requiresTrackedApplication: true,
      reason: `version ${target} is unapplied and the materialized schema is the pre-state; the canonical migration still has to be applied`
    };
  }
  return {
    decision: 'indeterminate',
    ok: false,
    recordedInHistory,
    schemaMatchesPre,
    schemaMatchesPost,
    requiresTrackedApplication: true,
    reason: `could not classify version ${target}: the schema probe matched neither the expected pre-state nor the expected post-state`
  };
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

  // Optional read-only guard: refuse a "history repair" while the materialized
  // schema is still stale (or already migrated but unrecorded). See issue #1072.
  const probePath = arg('--schema-probe');
  if (probePath) {
    const probeDoc = JSON.parse(fs.readFileSync(probePath, 'utf8'));
    const gate = evaluateApplicationGate({
      history: remote,
      schemaProbe: probeDoc.schema_probe,
      version: probeDoc.version,
      expected: probeDoc.expected
    });
    console.log(`Application gate (${probeDoc.version}): ${gate.decision}`);
    console.log(`  ${gate.reason}`);
    console.log(`  recorded_in_history=${gate.recordedInHistory} schema_pre=${gate.schemaMatchesPre} schema_post=${gate.schemaMatchesPost}`);
    if (!gate.ok) process.exitCode = 1;
  }

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
  projectRefFromUrl,
  evaluateApplicationGate
};
