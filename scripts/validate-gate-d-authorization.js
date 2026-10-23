"use strict";

/*
 * Gate D: application-authorization compatibility audit.
 *
 * Applies the canonical chain to an isolated PostgreSQL 17 instance, then drives
 * representative application operations as `authenticated` with a simulated JWT
 * subject and as `anon`, with RLS active. The SQL file asserts that authorized
 * operations succeed and unauthorized ones fail, and exits non-zero if any case
 * disagrees with the access policy.
 *
 * This is the question a privilege audit cannot answer: whether the privilege set
 * permits the operations the application actually performs.
 *
 * Isolation follows the harness: digest-pinned image, network none, no published
 * ports, no host mounts, teardown by container id. No staging or production
 * credential is present and no application or student data is used.
 */

const path = require("path");
const { spawnSync } = require("child_process");

const { validate } = require("./validate-migrations-disposable");
const { APPROVED_SUPABASE_IMAGE } = require("./lib/disposable-migration-container");

const CONTAINER = `tm-migval-authz-${process.pid}`;
const MATRIX = path.join(__dirname, "sql", "gate-d-authorization-matrix.sql");

const failures = [];

function check(label, ok, detail) {
  if (!ok) {
    failures.push(label);
  }

  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? ` -- ${detail}` : ""}`);
}

function docker(args) {
  const result = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

  return { exitCode: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

async function main() {
  let containerId = null;
  let teardownNeeded = false;

  try {
    const result = await validate({
      docker: docker,
      container: CONTAINER,
      image: APPROVED_SUPABASE_IMAGE,
      migrationsDirectory: "supabase/migrations",
      auditSqlPath: "db/scripts/grants_audit.sql",
      manifestPath: "docs/database/table-access-policy.json",
      log: (line) => console.log(`  [harness] ${line}`),
      logError: (line) => console.log(`  [harness] ${line}`),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => Date.now(),
      // Bound the readiness wait. Without this the gate cannot exit when the
      // container dies during initialisation, so the process hangs instead of
      // reporting the failure it is looking at.
      initTimeoutMs: 300000,
      initPollMs: 5000,
      keepContainer: true
    });

    check(
      "harness: canonical chain applied and the policy audit passed",
      result.ok === true,
      `${result.reason} ${JSON.stringify(result.steps.filter((step) => !step.ok))}`
    );

    const start = result.steps.find((step) => step.name === "start");
    containerId = start && start.detail ? String(start.detail).trim() : null;
    teardownNeeded = Boolean(containerId);

    check("harness: container kept for the audit", Boolean(containerId));

    if (!result.ok || !containerId) {
      return 1;
    }

    const copy = docker(["cp", MATRIX, `${containerId}:/work/authz.sql`]);

    check("audit: matrix SQL copied into the migrated container", copy.exitCode === 0, copy.stderr.trim());

    const matrix = docker([
      "exec",
      containerId,
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "/work/authz.sql"
    ]);

    console.log("  --- authorization matrix ---");

    for (const line of (matrix.stdout || "").split(/\r?\n/)) {
      if (line.trim()) {
        console.log(`    ${line.trim()}`);
      }
    }

    check(
      "audit: every case matched the access policy",
      matrix.exitCode === 0,
      (matrix.stderr || "").trim().slice(0, 500)
    );
  } catch (error) {
    check(`execution: ${error && error.message ? error.message : error}`, false);
  } finally {
    if (teardownNeeded && containerId) {
      docker(["rm", "-f", containerId]);

      const remaining = docker(["ps", "-a", "--filter", `id=${containerId}`, "-q"]).stdout.trim();

      check("teardown: disposable container removed", remaining === "");
    }
  }

  const ok = failures.length === 0;

  console.log(
    ok
      ? "  GATE D AUTHORIZATION AUDIT: ALL CHECKS PASSED"
      : `  GATE D AUTHORIZATION AUDIT: ${failures.length} CHECK(S) FAILED`
  );

  return ok ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`  FAIL  ${error && error.stack ? error.stack : error}`);
    process.exit(1);
  });
