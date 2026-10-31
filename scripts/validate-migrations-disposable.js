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
  APPROVED_SUPABASE_IMAGE_BY_DIGEST,
  BOOTSTRAP_SQL,
  DISPOSABLE_NAME_PREFIX,
  PLATFORM_MIGRATION_ROLE,
  assertDisposableContainerName,
  buildInitialisationProbeArgs,
  buildRoleEquivalenceArgs,
  classifyInitialisation,
  classifyRoleEquivalence,
  isolationViolations
} = require("./lib/disposable-migration-container");

const {
  buildRolePreconditionArgs,
  classifyMigrationsDirectory,
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
const CONTAINER_DB_USER = "postgres";
const CONTAINER_DB_NAME = "postgres";
// 127.0.0.1 rather than `localhost`, so no IPv6 resolution can pick a
// different listener than the one the probe verified.
const CONTAINER_DSN = `postgres://${CONTAINER_DB_USER}:validation-only@127.0.0.1:5432/${CONTAINER_DB_NAME}`;
const CONTAINER_MIGRATIONS_DIR = "/work/migrations";
const CONTAINER_AUDIT_SQL = "/work/grants_audit.sql";

/*
 * Read-only enumeration of the residual client privileges that the table-level
 * manifest does not cover: sequence USAGE and routine EXECUTE for `anon` and
 * `authenticated`. It reports what is present; it grants nothing, revokes
 * nothing and does not affect the validation verdict.
 */
const RESIDUAL_CLIENT_GRANTS_SQL = `
select 'sequence' as kind, c.relname as object, r.rolname as grantee
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('S', c.relowner))) a
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public' and c.relkind = 'S'
  and r.rolname in ('anon', 'authenticated') and a.privilege_type = 'USAGE'
union all
select 'routine' as kind, p.proname as object, r.rolname as grantee
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public'
  and r.rolname in ('anon', 'authenticated') and a.privilege_type = 'EXECUTE'
order by 1, 2, 3`;
const DEFAULT_MIGRATIONS_DIRECTORY = "supabase/migrations";
const DEFAULT_AUDIT_SQL_PATH = "db/scripts/grants_audit.sql";
// Measured: the image's entrypoint takes ~243 s to expose a TCP listener on a
// quiet host (server up -> shutdown/checkpoint -> "init process complete" ->
// restart -> listening). The budget covers a loaded host without weakening the
// readiness conditions, which stay "TCP reachable AND postmaster stable".
const DEFAULT_INIT_TIMEOUT_MS = 900000;
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

  let ownedContainerId = null;

  const teardown = () => {
    if (!started || keepContainer) {
      return;
    }

    // Ownership must be established before removal. A container that is not the
    // one this run created must never be deleted, and a name that has been
    // replaced by another run must not be mistaken for ours.
    const current = docker(["inspect", container, "--format", "{{.Id}}"]);
    const currentId = current.exitCode === 0 ? current.stdout.trim() : "";

    if (!ownedContainerId || currentId !== ownedContainerId) {
      record(
        "teardown",
        false,
        `refusing to remove "${container}": ownership not established (owned=${ownedContainerId || "unknown"})`
      );

      return;
    }

    const removal = docker(["rm", "-f", ownedContainerId]);
    record("teardown", removal.exitCode === 0, "disposable container removed");
  };

  try {
    // The canonical migration chain is the only valid target of this validator.
    // `MIGRATIONS_DIR` could otherwise repoint it at the legacy `db/migrations`
    // set, which applies a different (6-file) history and then fails in a way
    // that reads like a migration regression rather than a mis-targeted
    // validator. Refuse before any container work.
    const directory = classifyMigrationsDirectory(migrationsDirectory);

    if (!directory.ok) {
      record("migrations-directory", false, directory.message);

      return { ok: false, reason: directory.reason, steps, evidence };
    }

    record("migrations-directory", true, `canonical chain: ${directory.normalized}`);
    evidence.migrationsDirectory = directory.normalized;

    // Refuse to race. Two concurrent runs sharing a fixed container name would
    // let one run's teardown destroy the other's container mid-initialisation,
    // which is indistinguishable from a slow start (psql reports "connection
    // refused" for the whole timeout). Fail closed instead, and never remove a
    // container this run did not create.
    const existing = docker(["ps", "-a", "--filter", `name=^/${container}$`, "--format", "{{.Names}}"]);

    if (existing.exitCode === 0 && existing.stdout.trim() === container) {
      record("start", false, `container "${container}" already exists; refusing to race`);

      return { ok: false, reason: "container-name-in-use", steps, evidence };
    }

    const run = docker(["run", "-d", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=validation-only", image]);

    if (run.exitCode !== 0) {
      record("start", false, run.stderr.trim());
      return { ok: false, reason: "container-start-failed", steps, evidence };
    }

    started = true;
    ownedContainerId = run.stdout.trim();
    record("start", true, ownedContainerId.slice(0, 12));

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

    // Image provenance is established from the image, not from the container:
    // `docker inspect <container>` reports no digest metadata at all, and the
    // container's image id is the platform configuration id, which differs from
    // the pinned digest whenever the pinned digest is a manifest list.
    const imageInspectResult = docker(["image", "inspect", inspect.Image]);
    let imageInspect = null;

    if (imageInspectResult.exitCode === 0) {
      try {
        imageInspect = JSON.parse(imageInspectResult.stdout)[0] || null;
      } catch {
        imageInspect = null;
      }
    }

    // The approved reference resolved in the local image store. Comparing the
    // running image with it proves provenance without depending on the store
    // recording any digest metadata at all.
    const approvedImageResult = docker(["image", "inspect", APPROVED_SUPABASE_IMAGE_BY_DIGEST]);
    let approvedImageId = null;

    if (approvedImageResult.exitCode === 0) {
      try {
        const approvedImage = JSON.parse(approvedImageResult.stdout)[0];

        approvedImageId = (approvedImage && approvedImage.Id) || null;
      } catch {
        approvedImageId = null;
      }
    }

    const violations = isolationViolations({
      name: container,
      inspect,
      imageInspect,
      approvedImageId
    });

    evidence.isolation = {
      networkMode: inspect.HostConfig && inspect.HostConfig.NetworkMode,
      image: inspect.Image,
      imageProvenance: (imageInspect && imageInspect.RepoDigests) || []
    };

    if (violations.length > 0) {
      record("isolation", false, violations.join(" "));
      return { ok: false, reason: "isolation-violated", steps, evidence };
    }

    record("isolation", true, "network none, no mounts, no published ports, approved repository and digest provenance");

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

    // Platform equivalence must be proven before any SQL is applied. The hosted
    // preview ran migrations as a role that could not change `supabase_admin`
    // defaults, and a rehearsal under a superuser cannot reproduce that
    // boundary - it would pass where the platform fails. Refuse to continue
    // unless the execution role is the platform's migration role.
    const roleResult = docker([
      "exec",
      container,
      "psql",
      ...buildRoleEquivalenceArgs({ user: CONTAINER_DB_USER, database: CONTAINER_DB_NAME })
    ]);
    const equivalence = classifyRoleEquivalence({
      exitCode: roleResult.exitCode,
      stdout: roleResult.stdout,
      expectedRole: PLATFORM_MIGRATION_ROLE
    });

    evidence.roleEquivalence = {
      role: equivalence.role,
      sessionRole: equivalence.sessionRole,
      superuser: equivalence.superuser,
      platformMember: equivalence.platformMember,
      dbOwner: equivalence.dbOwner,
      createOnPublic: equivalence.createOnPublic
    };

    if (!equivalence.ok) {
      record("role-equivalence", false, equivalence.message);
      return { ok: false, reason: equivalence.reason, steps, evidence };
    }

    record("role-equivalence", true, equivalence.message);

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

    // Read-only enumeration of the residual client privileges the table-level
    // manifest does not cover. This reports; it grants nothing, revokes nothing,
    // and a failure to enumerate is reported rather than swallowed.
    const residual = exec(
      [
        "-v",
        "ON_ERROR_STOP=1",
        "--no-psqlrc",
        "-d",
        CONTAINER_DSN,
        "-A",
        "-t",
        "-c",
        RESIDUAL_CLIENT_GRANTS_SQL
      ],
      { phase: "residual-enumeration" }
    );

    if (residual.exitCode !== 0) {
      logError(
        `  residual client grant enumeration failed: ${String(residual.stderr || residual.stdout || "")
          .trim()
          .slice(0, 300)}`
      );
    } else {
      const residualLines = String(residual.stdout || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      evidence.residualClientGrants = residualLines;

      log(`  residual client grants (sequence USAGE / routine EXECUTE): ${residualLines.length}`);
      for (const line of residualLines) {
        log(`    ${line}`);
      }
    }

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
