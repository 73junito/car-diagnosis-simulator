#!/usr/bin/env node
"use strict";

/**
 * CLI wrapper for the disposable-Postgres migration validation.
 *
 * Used by `.github/workflows/apply-migrations.yml` in two steps so that
 * migration application and the grants audit remain separately visible:
 *
 *     node scripts/run-disposable-migration-validation.js --apply
 *     node scripts/run-disposable-migration-validation.js --audit
 *
 * Exit status is 0 only when every requested check succeeded. Any SQL error,
 * any audit query failure, any reported missing grant, an empty migration set,
 * and a non-disposable target all produce exit status 1.
 *
 * The process executor is injectable so the command can be exercised in tests
 * without Postgres.
 */

const { spawnSync } = require("child_process");

const {
  DEFAULT_MIGRATIONS_DIRECTORY,
  DEFAULT_AUDIT_SQL_PATH,
  runApply,
  runAudit,
  runValidation
} = require("./lib/disposable-migration-validation");

const MODES = Object.freeze(["--apply", "--audit", "--all"]);

/** Real executor: runs psql and reports its status, stdout and stderr. */
function createProcessExecutor({ spawn = spawnSync, cwd = process.cwd() } = {}) {
  return (args) => {
    const result = spawn("psql", args, { cwd, encoding: "utf8" });

    if (result.error) {
      return {
        exitCode: typeof result.status === "number" ? result.status : 127,
        stdout: result.stdout || "",
        stderr: `${result.stderr || ""}${result.error.message}\n`
      };
    }

    return {
      exitCode: typeof result.status === "number" ? result.status : 1,
      stdout: result.stdout || "",
      stderr: result.stderr || ""
    };
  };
}

/** Resolve the requested mode; `null` means the caller asked for something unknown. */
function parseMode(argv) {
  const flag = argv.find((value) => typeof value === "string" && value.startsWith("--")) || "--all";

  return MODES.includes(flag) ? flag : null;
}

function main(argv = process.argv.slice(2), deps = {}) {
  const mode = parseMode(argv);
  const log = deps.log || ((message) => process.stdout.write(`${message}\n`));
  const logError = deps.logError || ((message) => process.stderr.write(`${message}\n`));

  if (mode === null) {
    logError(`Unknown mode. Use one of: ${MODES.join(", ")}`);

    return 1;
  }

  const options = {
    databaseUrl: deps.databaseUrl !== undefined ? deps.databaseUrl : process.env.DATABASE_URL,
    migrationsDirectory:
      deps.migrationsDirectory !== undefined
        ? deps.migrationsDirectory
        : process.env.MIGRATIONS_DIR || DEFAULT_MIGRATIONS_DIRECTORY,
    auditSqlPath:
      deps.auditSqlPath !== undefined
        ? deps.auditSqlPath
        : process.env.GRANTS_AUDIT_SQL || DEFAULT_AUDIT_SQL_PATH,
    exec: deps.exec || createProcessExecutor(deps),
    log,
    logError
  };

  let result;

  if (mode === "--apply") {
    result = runApply(options);
  } else if (mode === "--audit") {
    result = runAudit(options);
  } else {
    result = runValidation(options);
  }

  return result.ok ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { MODES, createProcessExecutor, parseMode, main };
