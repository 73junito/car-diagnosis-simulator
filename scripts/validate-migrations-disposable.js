#!/usr/bin/env node
"use strict";

/**
 * End-to-end disposable migration validation.
 *
 * Starts the reviewed digest-pinned Supabase PostgreSQL 17 image with no
 * network, no published ports and no host mounts; proves the instance is
 * isolated; waits for complete initialisation; creates the documented empty
 * migration-bookkeeping relation; copies the canonical migrations in; applies
 * them fail-closed; then runs the role precondition and the grants audit.
 *
 * It never contacts staging or production, never writes migration history, and
 * removes the container when it finishes. The docker CLI and the clock are
 * injectable so the orchestration is unit-testable without Docker.
 */

const path = require("path");
const { spawnSync } = require("child_process");

const {
  APPROVED_SUPABASE_IMAGE,
  BOOTSTRAP_SQL,
  DISPOSABLE_NAME_PREFIX,
  assertDisposableContainerName,
  buildInitialisationProbeArgs,
  classifyInitialisation,
  isolationViolations
} = require("./lib/disposable-migration-container");

const {
  buildRolePreconditionArgs,
  classifyRolePrecondition,
  runApply
} = require("./lib/disposable-migration-validation");

const {
  DEFAULT_MANIFEST_PATH,
  buildPolicyProbeArgs,
  evaluatePolicy,
  loadManifest,
  parsePolicyProbe
} = require("./verify-table-access-policy");

const DEFAULT_CONTAINER = `${DISPOSABLE_NAME_PREFIX}-ci`;
const CONTAINER_DB_USER = "supabase_admin";
const CONTAINER_DB_NAME = "postgres";
// 127.0.0.1 rather than `localhost`, so no IPv6 resolution can pick a
// different listener than the one the probe verified.
const CONTAINER_DSN = `postgres://${CONTAINER_DB_USER}:validation-only@127.0.0.1:5432/${CONTAINER_DB_NAME}`;
const CONTAINER_MIGRATIONS_DIR = "/work/migrations";
const CONTAINER_AUDIT_SQL = "/work/grants_audit.sql";
const DEFAULT_MIGRATIONS_DIRECTORY = "supabase/migrations";
const DEFAULT_AUDIT_SQL_PATH = "db/scripts/grants_audit.sql";
const DEFAULT_INIT_TIMEOUT_MS = 600000;
const DEFAULT_INIT_POLL_MS = 5000;
// The entrypoint cycles the server, so require repeated identical postmaster
// start times before trusting the instance.
const DEFAULT_STABILITY_CHECKS = 2;

function createDockerCli({ spawn = spawnSync } = {}) {
  return (args) => {
    const result = spawn("docker", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

    return {
      exitCode: typeof result.status === "number" ? result.status : 1,
      stdout: result.stdout || "",
      stderr: `${result.stderr || ""}${result.error ? result.error.message : ""}`
    };
  };
}

/** Map a host path to where it was copied inside the container. */
function createPathMapper({ auditSqlPath = DEFAULT_AUDIT_SQL_PATH } = {}) {
  const auditBase = path.basename(auditSqlPath);

  return (hostPath) => {
    const base = path.basename(hostPath);

    return base === auditBase ? CONTAINER_AUDIT_SQL : `${CONTAINER_MIGRATIONS_DIR}/${base}`;
  };
}

/**
 * psql executor that runs inside the container. Only `-f` values are rewritten;
 * the rest of the argument vector is passed through unchanged, so
 * `-v ON_ERROR_STOP=1` and `--no-psqlrc` are preserved verbatim.
 */
function createContainerPsqlExecutor({ docker, container, mapPath }) {
  return (psqlArgs) => {
    const mapped = psqlArgs.map((value, index) => (psqlArgs[index - 1] === "-f" ? mapPath(value) : value));

    return docker(["exec", "-i", container, "psql", ...mapped]);
  };
}

/**
 * Run the whole validation. Returns `{ ok, reason, steps, evidence }`.
 * Every docker interaction goes through the injected CLI, so this is testable
 * without Docker and deterministic under a fake clock.
 */
async function validate({ docker, container, image, migrationsDirectory, auditSqlPath, manifestPath = DEFAULT_MANIFEST_PATH, log, logError, sleep, now, initTimeoutMs, initPollMs, stabilityChecks = DEFAULT_STABILITY_CHECKS, keepContainer }) {
  const steps = [];
  const evidence = {};
  let started = false;

  const record = (name, ok, detail) => {
    steps.push({ name, ok, detail });
    log(`[${ok ? "ok" : "FAIL"}] ${name}${detail ? `: ${detail}` : ""}`);
  };

  const teardown = () => {
    if (!started || keepContainer) {
      return;
    }

    const removal = docker(["rm", "-f", container]);
    record("teardown", removal.exitCode === 0, "disposable container removed");
  };

  try {
    const run = docker(["run", "-d", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=validation-only", image]);

    if (run.exitCode !== 0) {
      record("start", false, run.stderr.trim());
      return { ok: false, reason: "container-start-failed", steps, evidence };
    }

    started = true;
    record("start", true, run.stdout.trim().slice(0, 12));

    // Isolation must be proven before anything is executed inside the container.
    const inspectResult = docker(["inspect", container]);

    if (inspectResult.exitCode !== 0) {
      record("isolation", false, "docker inspect failed");
      return { ok: false, reason: "isolation-unknown", steps, evidence };
    }

    let inspect;

    try {
      inspect = JSON.parse(inspectResult.stdout)[0];
    } catch {
      record("isolation", false, "docker inspect output was not parseable");
      return { ok: false, reason: "isolation-unknown", steps, evidence };
    }

    const violations = isolationViolations({ name: container, inspect });

    evidence.isolation = { networkMode: inspect.HostConfig && inspect.HostConfig.NetworkMode, image: inspect.Image };

    if (violations.length > 0) {
      record("isolation", false, violations.join(" "));
      return { ok: false, reason: "isolation-violated", steps, evidence };
    }

    record("isolation", true, "network none, no mounts, no published ports, approved digest");

    // Wait for complete initialisation. `pg_isready` is explicitly not enough:
    // the entrypoint starts the server, shuts it down and starts it again, so
    // the probe runs over TCP (the transport the migrations use) and the
    // postmaster start time must repeat before the instance is trusted.
    const deadline = now() + initTimeoutMs;
    let initialisation = null;
    let previousStartEpoch = null;
    let stableReadings = 0;

    for (;;) {
      const probe = docker([
        "exec",
        container,
        "psql",
        ...buildInitialisationProbeArgs({ user: CONTAINER_DB_USER, database: CONTAINER_DB_NAME })
      ]);
      initialisation = classifyInitialisation({ exitCode: probe.exitCode, stdout: probe.stdout });

      const sameServer =
        initialisation.ready &&
        initialisation.startEpoch !== null &&
        initialisation.startEpoch === previousStartEpoch;

      stableReadings = sameServer ? stableReadings + 1 : 0;
      previousStartEpoch = initialisation.startEpoch;

      if (stableReadings >= stabilityChecks || now() >= deadline) {
        break;
      }

      await sleep(initPollMs);
    }

    evidence.initialisation = {
      ready: initialisation.ready,
      stable: stableReadings >= stabilityChecks,
      startEpoch: initialisation.startEpoch,
      schemas: initialisation.schemas,
      roles: initialisation.roles
    };

    if (!initialisation.ready || stableReadings < stabilityChecks) {
      record(
        "initialisation",
        false,
        `${initialisation.message} (stable readings ${stableReadings}/${stabilityChecks})`
      );
      return { ok: false, reason: "initialisation-timeout", steps, evidence };
    }

    record("initialisation", true, initialisation.message);

    // Documented empty bookkeeping shim. No history row is ever inserted.
    const bootstrap = docker(["exec", container, "psql", "-U", CONTAINER_DB_USER, "-d", CONTAINER_DB_NAME, "-v", "ON_ERROR_STOP=1", "--no-psqlrc", "-c", BOOTSTRAP_SQL]);

    if (bootstrap.exitCode !== 0) {
      record("bootstrap", false, bootstrap.stderr.trim());
      return { ok: false, reason: "bootstrap-failed", steps, evidence };
    }

    record("bootstrap", true, "empty supabase_migrations.schema_migrations created; no history written");

    // Controlled read-only copy in; no bind mount, so nothing on the host is writable.
    docker(["exec", container, "mkdir", "-p", CONTAINER_MIGRATIONS_DIR]);
    const copy = docker(["cp", `${migrationsDirectory}/.`, `${container}:${CONTAINER_MIGRATIONS_DIR}/`]);
    const copyAudit = docker(["cp", auditSqlPath, `${container}:${CONTAINER_AUDIT_SQL}`]);

    if (copy.exitCode !== 0 || copyAudit.exitCode !== 0) {
      record("transfer", false, `${copy.stderr}${copyAudit.stderr}`.trim());
      return { ok: false, reason: "transfer-failed", steps, evidence };
    }

    record("transfer", true, "migrations and audit SQL copied into the container");

    const exec = createContainerPsqlExecutor({
      docker,
      container,
      mapPath: createPathMapper({ auditSqlPath })
    });

    const apply = runApply({ databaseUrl: CONTAINER_DSN, migrationsDirectory, exec, log, logError });

    evidence.applied = apply.applied.length;

    if (!apply.ok) {
      record("apply", false, apply.message);
      return { ok: false, reason: apply.reason, steps, evidence };
    }

    record("apply", true, `${apply.applied.length} canonical migration(s) applied with ON_ERROR_STOP=1`);

    const preconditionResult = exec(buildRolePreconditionArgs({ databaseUrl: CONTAINER_DSN }), {
      phase: "role-precondition"
    });
    const precondition = classifyRolePrecondition({
      exitCode: preconditionResult.exitCode,
      stdout: preconditionResult.stdout
    });

    evidence.roles = precondition.present;

    if (!precondition.ok) {
      record("audit", false, precondition.message);
      return { ok: false, reason: precondition.reason, steps, evidence };
    }

    // Policy-aligned privilege audit: the live database is compared against the
    // reviewed manifest in both directions, so a missing privilege and an
    // unexpected privilege both fail.
    const probeResult = exec(buildPolicyProbeArgs({ databaseUrl: CONTAINER_DSN }), {
      phase: "policy-probe"
    });
    const policy = evaluatePolicy({
      manifest: loadManifest(manifestPath),
      probe: parsePolicyProbe({ exitCode: probeResult.exitCode, stdout: probeResult.stdout })
    });

    evidence.policy = policy.summary;

    if (!policy.ok) {
      record("audit", false, `${policy.summary.violations} table access policy violation(s)`);

      for (const violation of policy.violations.slice(0, 12)) {
        logError(`  ${violation.code}: ${violation.detail}`);
      }

      return { ok: false, reason: "policy-violation", steps, evidence };
    }

    record(
      "audit",
      true,
      `table access policy satisfied (${policy.summary.tablesInDatabase} tables, ${policy.summary.roleComparisons} role comparisons)`
    );

    return { ok: true, reason: null, steps, evidence };
  } finally {
    teardown();
  }
}

async function main(argv = process.argv.slice(2), deps = {}) {
  const log = deps.log || ((message) => process.stdout.write(`${message}\n`));
  const logError = deps.logError || ((message) => process.stderr.write(`${message}\n`));
  const containerIndex = argv.indexOf("--container");
  const container =
    containerIndex >= 0 && argv[containerIndex + 1]
      ? argv[containerIndex + 1]
      : process.env.MIGRATION_VALIDATION_CONTAINER || DEFAULT_CONTAINER;

  const nameError = assertDisposableContainerName(container);

  if (nameError) {
    logError(nameError);

    return 1;
  }

  const result = await validate({
    docker: deps.docker || createDockerCli(),
    container,
    image: process.env.MIGRATION_VALIDATION_IMAGE || APPROVED_SUPABASE_IMAGE,
    migrationsDirectory: process.env.MIGRATIONS_DIR || DEFAULT_MIGRATIONS_DIRECTORY,
    auditSqlPath: process.env.GRANTS_AUDIT_SQL || DEFAULT_AUDIT_SQL_PATH,
    manifestPath: process.env.TABLE_ACCESS_POLICY || DEFAULT_MANIFEST_PATH,
    log,
    logError,
    sleep: deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    now: deps.now || (() => Date.now()),
    initTimeoutMs: deps.initTimeoutMs || DEFAULT_INIT_TIMEOUT_MS,
    initPollMs: deps.initPollMs || DEFAULT_INIT_POLL_MS,
    stabilityChecks: deps.stabilityChecks || DEFAULT_STABILITY_CHECKS,
    keepContainer: argv.includes("--keep-container")
  });

  log(`MIGRATION VALIDATION EVIDENCE: ${JSON.stringify({ ok: result.ok, reason: result.reason, evidence: result.evidence })}`);

  return result.ok ? 0 : 1;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  });
}

module.exports = {
  CONTAINER_DSN,
  CONTAINER_MIGRATIONS_DIR,
  CONTAINER_AUDIT_SQL,
  DEFAULT_CONTAINER,
  DEFAULT_INIT_TIMEOUT_MS,
  DEFAULT_INIT_POLL_MS,
  DEFAULT_STABILITY_CHECKS,
  createDockerCli,
  createPathMapper,
  createContainerPsqlExecutor,
  validate,
  main
};
