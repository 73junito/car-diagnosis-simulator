"use strict";

/**
 * Fail-closed validation logic for the disposable-Postgres migration workflow
 * (`.github/workflows/apply-migrations.yml`).
 *
 * Why this module exists
 * ----------------------
 * `psql -f <script>` does NOT report a SQL error through its exit status unless
 * `ON_ERROR_STOP` is enabled. Per the documented psql exit statuses, an error
 * inside a script yields status 3 only when `ON_ERROR_STOP` is on; with the
 * default (off) psql exits 0 after printing the error. The workflow previously
 * ran:
 *
 *     psql "$DATABASE_URL" -f "$f"
 *     psql "$DATABASE_URL" -At -F"," -f db/scripts/grants_audit.sql > out || true
 *
 * Both forms are fail-open: failing statements were swallowed, and `|| true`
 * made a failed audit query indistinguishable from an audit that found nothing.
 *
 * This module holds the decision logic only. It performs no database access,
 * takes its process executor as an injected parameter, and is therefore
 * unit-testable without Postgres, without bash, and without network access.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_MIGRATIONS_DIRECTORY = "db/migrations";
const DEFAULT_AUDIT_SQL_PATH = "db/scripts/grants_audit.sql";

/**
 * Hosts that can only ever be a disposable database owned by the CI job.
 * Anything else is refused before a single statement is executed, so the
 * workflow cannot be repointed at staging or production by an env change.
 */
const DISPOSABLE_HOSTS = Object.freeze(["localhost", "127.0.0.1", "::1"]);

/** Accepted DSN schemes. */
const ACCEPTED_SCHEMES = Object.freeze(["postgres:", "postgresql:"]);

/** The single flag that makes psql fail closed on script errors. */
const ON_ERROR_STOP = "ON_ERROR_STOP=1";

/** The three audit outcomes that must remain distinguishable. */
const AUDIT_OUTCOMES = Object.freeze({
  CLEAN: "clean",
  MISSING_GRANTS: "missing-grants",
  AUDIT_FAILED: "audit-failed"
});

const FAILURE_REASONS = Object.freeze({
  MISSING_DATABASE_URL: "missing-database-url",
  INVALID_DATABASE_URL: "invalid-database-url",
  NON_DISPOSABLE_TARGET: "non-disposable-target",
  NO_MIGRATIONS: "no-migrations",
  MIGRATION_FAILED: "migration-failed",
  AUDIT_FAILED: "audit-failed",
  MISSING_GRANTS: "missing-grants"
});

/** Replace any `user:password@` credentials with a fixed marker for logging. */
function redactDatabaseUrl(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    return "(unset)";
  }

  return databaseUrl.replace(/\/\/[^/@]*@/, "//***@");
}

/**
 * Parse and authorise the DSN. Returns `{ ok: true, host, port, redacted }`
 * or `{ ok: false, reason, message }`. Never throws.
 */
function parseDatabaseTarget(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    return {
      ok: false,
      reason: FAILURE_REASONS.MISSING_DATABASE_URL,
      message: "DATABASE_URL is not set; refusing to run migration validation."
    };
  }

  let parsed;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    return {
      ok: false,
      reason: FAILURE_REASONS.INVALID_DATABASE_URL,
      message: `DATABASE_URL is not a parseable URL: ${redactDatabaseUrl(databaseUrl)}`
    };
  }

  if (!ACCEPTED_SCHEMES.includes(parsed.protocol)) {
    return {
      ok: false,
      reason: FAILURE_REASONS.INVALID_DATABASE_URL,
      message: `DATABASE_URL must use a postgres scheme; received "${parsed.protocol}".`
    };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (!DISPOSABLE_HOSTS.includes(host)) {
    return {
      ok: false,
      reason: FAILURE_REASONS.NON_DISPOSABLE_TARGET,
      message:
        `Refusing to run migration validation against host "${host}". ` +
        `Only disposable hosts are allowed (${DISPOSABLE_HOSTS.join(", ")}); ` +
        "staging and production targets are never valid for this workflow."
    };
  }

  return {
    ok: true,
    host,
    port: parsed.port || "",
    redacted: redactDatabaseUrl(databaseUrl)
  };
}

/**
 * List `*.sql` files in a directory, sorted lexicographically.
 *
 * Sorting reproduces the shell glob order the workflow used, so migration
 * execution order is preserved. A missing or unreadable directory returns an
 * empty list rather than throwing; callers must treat that as a failure.
 */
function discoverMigrationFiles(directory, { readdir = fs.readdirSync, stat = fs.statSync } = {}) {
  let entries;

  try {
    entries = readdir(directory);
  } catch {
    return [];
  }

  return entries
    .filter((name) => /\.sql$/i.test(name))
    .filter((name) => {
      try {
        return stat(path.join(directory, name)).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

/**
 * Build the psql argument vector. `ON_ERROR_STOP=1` and `--no-psqlrc` are
 * always present, so no invocation of this workflow can silently ignore a
 * SQL error or pick up a runner-local psqlrc.
 */
function buildPsqlArgs({ databaseUrl, file, tuplesOnly = false, fieldSeparator = null }) {
  const args = ["-v", ON_ERROR_STOP, "--no-psqlrc", "-d", databaseUrl];

  if (tuplesOnly) {
    args.push("-A", "-t");
  }

  if (fieldSeparator !== null) {
    args.push("-F", fieldSeparator);
  }

  args.push("-f", file);

  return args;
}

/**
 * Classify the grants audit into exactly one of three outcomes:
 *   - `clean`          query succeeded, no rows  -> pass
 *   - `missing-grants` query succeeded, rows     -> fail
 *   - `audit-failed`   query did not succeed     -> fail
 *
 * The third outcome is the one the previous `|| true` collapsed into `clean`.
 */
function classifyAuditOutcome({ exitCode, stdout = "" }) {
  if (exitCode !== 0) {
    return {
      outcome: AUDIT_OUTCOMES.AUDIT_FAILED,
      failed: true,
      rows: [],
      message:
        `Grants audit FAILED: the audit query exited with status ${exitCode}. ` +
        "This is a query failure, not an empty audit result; no grant conclusion can be drawn."
    };
  }

  const rows = String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rows.length > 0) {
    return {
      outcome: AUDIT_OUTCOMES.MISSING_GRANTS,
      failed: true,
      rows,
      message: `Grants audit FAILED: ${rows.length} missing required Data API grant row(s) reported.`
    };
  }

  return {
    outcome: AUDIT_OUTCOMES.CLEAN,
    failed: false,
    rows: [],
    message: "Grants audit clean: the audit query succeeded and returned no rows."
  };
}

/**
 * Apply every migration in order, stopping at the first failure.
 *
 * `exec(args, context)` must return `{ exitCode, stdout, stderr }`. It is
 * injected so tests can simulate psql without a database.
 */
function runApply({
  databaseUrl,
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
  exec,
  log = () => {},
  logError = () => {}
}) {
  requireExecutor(exec);

  const target = parseDatabaseTarget(databaseUrl);

  if (!target.ok) {
    logError(target.message);
    return { ok: false, reason: target.reason, applied: [], failedFile: null, message: target.message };
  }

  log(`Migration validation target: ${target.redacted}`);

  const files = discoverMigrationFiles(migrationsDirectory);

  if (files.length === 0) {
    const message =
      `No migration files found in "${migrationsDirectory}". ` +
      "Refusing to report success: an empty migration set would otherwise pass without applying anything.";
    logError(message);
    return { ok: false, reason: FAILURE_REASONS.NO_MIGRATIONS, applied: [], failedFile: null, message };
  }

  log(`Discovered ${files.length} migration file(s) in "${migrationsDirectory}".`);

  const applied = [];

  for (const file of files) {
    log(`--- applying ${file} ---`);

    const result = exec(buildPsqlArgs({ databaseUrl, file }), { phase: "apply", file });
    const exitCode = exitCodeOf(result);

    if (exitCode !== 0) {
      const message =
        `Migration FAILED: "${file}" exited with status ${exitCode} under ON_ERROR_STOP=1. ` +
        "Aborting before applying any later migration.";
      logError(message);
      if (result && result.stderr) {
        logError(String(result.stderr).trim());
      }
      return { ok: false, reason: FAILURE_REASONS.MIGRATION_FAILED, applied, failedFile: file, message };
    }

    applied.push(file);
  }

  log(`Applied ${applied.length} migration(s) with ON_ERROR_STOP=1.`);

  return { ok: true, reason: null, applied, failedFile: null, message: `Applied ${applied.length} migration(s).` };
}

/** Guard: the executor must be injected explicitly. */
function requireExecutor(exec) {
  if (typeof exec !== "function") {
    throw new TypeError("A process executor function is required.");
  }
}

/** Normalise a missing or malformed executor result into a failure status. */
function exitCodeOf(result) {
  if (!result || typeof result.exitCode !== "number" || Number.isNaN(result.exitCode)) {
    return 1;
  }

  return result.exitCode;
}

/**
 * Run the grants audit and classify the result. Validates the target first, so
 * the audit step cannot be pointed at a non-disposable database either.
 */
function runAudit({
  databaseUrl,
  auditSqlPath = DEFAULT_AUDIT_SQL_PATH,
  exec,
  log = () => {},
  logError = () => {}
}) {
  requireExecutor(exec);

  const target = parseDatabaseTarget(databaseUrl);

  if (!target.ok) {
    logError(target.message);
    return { ok: false, reason: target.reason, audit: null, message: target.message };
  }

  log(`Grants audit target: ${target.redacted}`);

  const result = exec(
    buildPsqlArgs({ databaseUrl, file: auditSqlPath, tuplesOnly: true, fieldSeparator: "," }),
    { phase: "audit", file: auditSqlPath }
  );

  const audit = classifyAuditOutcome({
    exitCode: exitCodeOf(result),
    stdout: result ? result.stdout : ""
  });

  if (audit.failed) {
    logError(audit.message);

    if (result && result.stderr) {
      logError(String(result.stderr).trim());
    }

    for (const row of audit.rows) {
      logError(`  ${row}`);
    }

    return {
      ok: false,
      reason:
        audit.outcome === AUDIT_OUTCOMES.AUDIT_FAILED
          ? FAILURE_REASONS.AUDIT_FAILED
          : FAILURE_REASONS.MISSING_GRANTS,
      audit,
      message: audit.message
    };
  }

  log(audit.message);

  return { ok: true, reason: null, audit, message: audit.message };
}

/** Apply then audit, for a single-step invocation. */
function runValidation(options) {
  const apply = runApply(options);

  if (!apply.ok) {
    return { ok: false, reason: apply.reason, applied: apply.applied, failedFile: apply.failedFile, audit: null, message: apply.message };
  }

  const audit = runAudit(options);

  return {
    ok: audit.ok,
    reason: audit.reason,
    applied: apply.applied,
    failedFile: null,
    audit: audit.audit,
    message: audit.message
  };
}

module.exports = {
  DEFAULT_MIGRATIONS_DIRECTORY,
  DEFAULT_AUDIT_SQL_PATH,
  DISPOSABLE_HOSTS,
  ACCEPTED_SCHEMES,
  ON_ERROR_STOP,
  AUDIT_OUTCOMES,
  FAILURE_REASONS,
  redactDatabaseUrl,
  parseDatabaseTarget,
  discoverMigrationFiles,
  buildPsqlArgs,
  classifyAuditOutcome,
  runApply,
  runAudit,
  runValidation
};
