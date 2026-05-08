#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load .env from repository root `torquemind-api/.env`
const envPath = path.resolve(__dirname, '..', '.env');
const dotenvResult = require('dotenv').config({ path: envPath });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');

function getEnv(name, fallback) {
  return process.env[name] || fallback;
}

const PGHOST = getEnv('PGHOST', '');
const PGPORT = Number(getEnv('PGPORT', 5432));
const PGDATABASE = getEnv('PGDATABASE', 'postgres');
const PGUSER = getEnv('PGUSER', 'postgres');
const PGPASSWORD = getEnv('PGPASSWORD', '');
const PGSSLMODE = getEnv('PGSSLMODE', 'require');
const PGSSLROOTCERT = getEnv('PGSSLROOTCERT', '');

async function main() {
  console.log('DB SSL Validator starting...');
  console.log('Dry-run:', dryRun ? 'yes' : 'no');

  if (dotenvResult.error) {
    console.log('No .env loaded from', envPath);
  } else {
    console.log('.env loaded from', envPath);
  }

  // Report which env vars are present
  const required = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE'];
  const present = required.filter(k => !!getEnv(k));
  const missing = required.filter(k => !getEnv(k));
  console.log('Env vars present:', present.join(', ') || '(none)');
  if (missing.length) console.log('Env vars missing:', missing.join(', '));

  console.log('PGSSLMODE:', PGSSLMODE || '(not set)');
  console.log('PGSSLROOTCERT:', PGSSLROOTCERT || '(not set)');

  if (PGSSLROOTCERT) {
    const exists = fs.existsSync(PGSSLROOTCERT);
    console.log('CA file exists:', exists ? 'yes' : 'no', PGSSLROOTCERT);
    if (!exists) {
      console.warn('Warning: CA file path provided but file not found. Ensure the path is correct.');
    }
  } else if (PGSSLMODE === 'verify-full' || PGSSLMODE === 'verify-ca') {
    console.warn('Warning: SSL mode requires a CA file (PGSSLROOTCERT) for full verification.');
  }

  if (dryRun) {
    console.log('Dry-run mode: no DB connection will be attempted. Exiting with code 0 for diagnostics only.');
    process.exitCode = 0;
    return;
  }

  if (!PGHOST) {
    console.error('Fatal: PGHOST is not set. Set PGHOST in torquemind-api/.env and try again.');
    process.exitCode = 4;
    return;
  }

  const clientConfig = {
    host: PGHOST,
    port: PGPORT,
    database: PGDATABASE,
    user: PGUSER,
    password: PGPASSWORD || undefined,
  };

  if (PGSSLROOTCERT) {
    try {
      const ca = fs.readFileSync(PGSSLROOTCERT);
      clientConfig.ssl = {
        rejectUnauthorized: true,
        ca: ca.toString()
      };
      console.log('Using CA cert:', PGSSLROOTCERT);
    } catch (err) {
      console.error('Failed to read PGSSLROOTCERT at', PGSSLROOTCERT + ':', err.message);
      process.exitCode = 2;
      return;
    }
  } else if (PGSSLMODE && PGSSLMODE !== 'disable') {
    // If no CA provided but SSL requested, allow TLS but do not verify CA
    clientConfig.ssl = { rejectUnauthorized: false };
    console.log('SSL enabled without CA verification (no PGSSLROOTCERT).');
  }

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('Connected to DB. Running `select version()`...');
    const res = await client.query('select version()');
    console.log('Postgres version:', res.rows && res.rows[0] && Object.values(res.rows[0])[0]);

    // Optional: run classroom_policies.sql if present
    const policiesPath = path.resolve(__dirname, '..', 'db', 'classroom_policies.sql');
    if (fs.existsSync(policiesPath)) {
      console.log('Found classroom_policies.sql — showing preview and guidance (will not modify DB schema).');
      const sql = fs.readFileSync(policiesPath, 'utf8');
      console.log(sql.slice(0, 400).replace(/\n/g, ' ') + (sql.length > 400 ? '...' : ''));
      console.log('To validate policies safely, run psql and inspect the policy definitions, or use a read-only role.');
    } else {
      console.log('No classroom_policies.sql found at', policiesPath);
    }

    await client.end();
    console.log('Validation complete — connection succeeded.');
    process.exitCode = 0;
  } catch (err) {
    // Provide richer guidance based on common errors
    console.error('DB connection / query failed:', err.message);
    if (/The server does not support SSL connections/i.test(err.message)) {
      console.warn('Suggestion: The server refused SSL. Verify your `PGSSLMODE` and whether the server expects TLS.');
    }
    if (/certificate/i.test(err.message) || /self signed certificate/i.test(err.message)) {
      console.warn('Suggestion: SSL certificate verification failed. Confirm `PGSSLROOTCERT` points to the CA used by the server.');
    }
    process.exitCode = 3;
    try { await client.end(); } catch (e) {}
  }
}

main();
