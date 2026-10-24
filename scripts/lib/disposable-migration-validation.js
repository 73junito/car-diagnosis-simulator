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

// The canonical migration chain for the Supabase-managed application schema.
// `db/migrations` is legacy/historical (docs/database/migration-authority.md)
// and must never be the silent default target of a canonical validation.
const DEFAULT_MIGRATIONS_DIRECTORY = "supabase/migrations";
const LEGACY_MIGRATIONS_DIRECTORY = "db/migrations";
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

/**
 * The roles the grants audit reasons about.
 *
 * `db/scripts/grants_audit.sql` guards every query with
 * `EXISTS (... rolname = '<role>')`, so when these roles are absent the audit
 * returns zero rows — indistinguishable from "all grants present". The
 * precondition check below exists to make that state impossible to report as a
 * passing audit. `tests/disposable-migration-validation.test.js` asserts this
 * set matches the roles named in the audit SQL, so the two cannot drift.
 */
const AUDITED_ROLES = Object.freeze(["authenticated", "anon"]);

/** The five audit outcomes that must remain distinguishable. */
const AUDIT_OUTCOMES = Object.freeze({
  CLEAN: "clean",
  MISSING_GRANTS: "missing-grants",
  AUDIT_FAILED: "audit-failed",
  ROLES_MISSING: "roles-missing",
  ROLE_CHECK_FAILED: "role-check-failed"
});

const FAILURE_REASONS = Object.freeze({
  MISSING_DATABASE_URL: "missing-database-url",
  INVALID_DATABASE_URL: "invalid-database-url",
  NON_DISPOSABLE_TARGET: "non-disposable-target",
  NO_MIGRATIONS: "no-migrations",
  MIGRATION_FAILED: "migration-failed",
  AUDIT_FAILED: "audit-failed",
  MISSING_GRANTS: "missing-grants",
  ROLES_MISSING: "roles-missing",
  ROLE_CHECK_FAILED: "role-check-failed",
  LEGACY_MIGRATIONS_DIRECTORY: "legacy-migrations-directory"
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
 * The precondition query: which audited roles exist in this database.
 * Derived from AUDITED_ROLES so the gate cannot drift from the constant.
 */
function rolePreconditionSql(roles = AUDITED_ROLES) {
  const list = roles.map((role) => `'${role}'`).join(",");

  return `select rolname from pg_roles where rolname in (${list}) order by rolname`;
}

/** Read-only psql arguments for the role precondition query. */
function buildRolePreconditionArgs({ databaseUrl, roles = AUDITED_ROLES }) {
  return ["-v", ON_ERROR_STOP, "--no-psqlrc", "-d", databaseUrl, "-A", "-t", "-c", rolePreconditionSql(roles)];
}

/**
 * Decide whether the grants audit is even applicable.
 *
 * A missing audited role is not an error in the audit query, and it must not be
 * confused with either a clean audit or a failed one: the audit cannot reach a
 * conclusion at all, so it fails closed with its own distinct reason.
 */
function classifyRolePrecondition({ exitCode, stdout = "", roles = AUDITED_ROLES }) {
  if (exitCode !== 0) {
    return {
      ok: false,
      reason: FAILURE_REASONS.ROLE_CHECK_FAILED,
      outcome: AUDIT_OUTCOMES.ROLE_CHECK_FAILED,
      present: [],
      missing: [...roles],
      message:
        `Role precondition FAILED: the role query exited with status ${exitCode}. ` +
        "The environment is unverified, so no grant conclusion can be drawn."
    };
  }

  const present = String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const missing = roles.filter((role) => !present.includes(role));

  if (missing.length > 0) {
    return {
      ok: false,
      reason: FAILURE_REASONS.ROLES_MISSING,
      outcome: AUDIT_OUTCOMES.ROLES_MISSING,
      present,
      missing,
      message:
        `Grants audit NOT APPLICABLE: required role(s) absent (${missing.join(", ")}). ` +
        "The audit SQL skips every query when a role is absent, so an empty result would be " +
        "vacuous rather than clean. Refusing to report success."
    };
  }

  return {
    ok: true,
    reason: null,
    outcome: null,
    present,
    missing: [],
    message: `Role precondition satisfied: ${present.join(", ")} present.`
  };
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
 * Normalise a migration directory for comparison: unify separators, strip a
 * leading "./" and any trailing slashes, so the same directory written two ways
 * compares equal.
 */
function normalizeMigrationDirectory(directory) {
  if (typeof directory !== "string") {
    return "";
  }

  return path
    .normalize(directory)
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

/**
 * Decide whether a migration directory may be validated.
 *
 * A non-empty but wrong directory used to validate silently: the legacy
 * `db/migrations` set (6 files) applied, failed, and reported a failure that
 * read like a migration regression rather than a mis-targeted validator. The
 * legacy directory is therefore refused outright.
 *
 * `allowLegacy` is an in-code opt-in rather than an environment switch, so no
 * environment change can silently repoint the canonical validation path.
 */
function classifyMigrationsDirectory(directory, { allowLegacy = false } = {}) {
  const normalized = normalizeMigrationDirectory(directory);

  if (normalized === "" || normalized === ".") {
    const message = `No migration directory was resolved (received ${JSON.stringify(directory)}).`;
    return { ok: false, reason: FAILURE_REASONS.NO_MIGRATIONS, legacy: false, normalized, message };
  }

  const legacy =
    normalized === LEGACY_MIGRATIONS_DIRECTORY || normalized.endsWith(`/${LEGACY_MIGRATIONS_DIRECTORY}`);

  if (legacy && !allowLegacy) {
    const message =
      `Refusing to validate the legacy migration directory "${directory}". ` +
      `"${LEGACY_MIGRATIONS_DIRECTORY}" is retained for history only; the canonical chain is ` +
      `"${DEFAULT_MIGRATIONS_DIRECTORY}". Pass allowLegacy only from a test that targets the legacy set.`;
    return { ok: false, reason: FAILURE_REASONS.LEGACY_MIGRATIONS_DIRECTORY, legacy, normalized, message };
  }

  return { ok: true, reason: null, legacy, normalized, message: null };
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
  allowLegacyDirectory = false,
  resolveFilePath = (name) => path.join(migrationsDirectory, name),
  exec,
  log = () => {},
  logError = () => {}
}) {
  requireExecutor(exec);

  // Refuse a migration set that is not the canonical chain before applying
  // anything. An undefined `migrationsDirectory` now resolves to the canonical
  // chain rather than silently falling back to the legacy directory.
  const directory = classifyMigrationsDirectory(migrationsDirectory, { allowLegacy: allowLegacyDirectory });

  if (!directory.ok) {
    logError(directory.message);
    return { ok: false, reason: directory.reason, applied: [], failedFile: null, message: directory.message };
  }

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

    const result = exec(buildPsqlArgs({ databaseUrl, file: resolveFilePath(file) }), { phase: "apply", file });
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
 *
 * Order matters: the audited roles are verified *before* the audit runs, because
 * the audit SQL skips every query when a role is absent. Without that
 * precondition a database with no `authenticated` role reports a "clean" audit
 * that proves nothing.
 */
function runAudit({
  databaseUrl,
  auditSqlPath = DEFAULT_AUDIT_SQL_PATH,
  roles = AUDITED_ROLES,
  exec,
  log = () => {},
  logError = () => {}
}) {
  requireExecutor(exec);

  const target = parseDatabaseTarget(databaseUrl);

  if (!target.ok) {
    logError(target.message);
    return { ok: false, reason: target.reason, audit: null, precondition: null, message: target.message };
  }

  log(`Grants audit target: ${target.redacted}`);

  const preconditionResult = exec(buildRolePreconditionArgs({ databaseUrl, roles }), {
    phase: "role-precondition"
  });
  const precondition = classifyRolePrecondition({
    exitCode: exitCodeOf(preconditionResult),
    stdout: preconditionResult ? preconditionResult.stdout : "",
    roles
  });

  if (!precondition.ok) {
    logError(precondition.message);

    if (preconditionResult && preconditionResult.stderr) {
      logError(String(preconditionResult.stderr).trim());
    }

    return {
      ok: false,
      reason: precondition.reason,
      precondition,
      audit: {
        outcome: precondition.outcome,
        failed: true,
        rows: [],
        presentRoles: precondition.present,
        missingRoles: precondition.missing
      },
      message: precondition.message
    };
  }

  log(precondition.message);

  const result = exec(
    buildPsqlArgs({ databaseUrl, file: auditSqlPath, tuplesOnly: true, fieldSeparator: "," }),
    { phase: "audit", file: auditSqlPath }
  );

  const audit = {
    ...classifyAuditOutcome({
      exitCode: exitCodeOf(result),
      stdout: result ? result.stdout : ""
    }),
    presentRoles: precondition.present,
    missingRoles: []
  };

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
      precondition,
      audit,
      message: audit.message
    };
  }

  log(audit.message);

  return { ok: true, reason: null, precondition, audit, message: audit.message };
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
    precondition: audit.precondition,
    audit: audit.audit,
    message: audit.message
  };
}

module.exports = {
  DEFAULT_MIGRATIONS_DIRECTORY,
  LEGACY_MIGRATIONS_DIRECTORY,
  DEFAULT_AUDIT_SQL_PATH,
  DISPOSABLE_HOSTS,
  ACCEPTED_SCHEMES,
  ON_ERROR_STOP,
  AUDITED_ROLES,
  AUDIT_OUTCOMES,
  FAILURE_REASONS,
  redactDatabaseUrl,
  parseDatabaseTarget,
  discoverMigrationFiles,
  normalizeMigrationDirectory,
  classifyMigrationsDirectory,
  buildPsqlArgs,
  rolePreconditionSql,
  buildRolePreconditionArgs,
  classifyRolePrecondition,
  classifyAuditOutcome,
  runApply,
  runAudit,
  runValidation
};
