"use strict";

/*
 * Gate D: independent cross-check of the table access policy.
 *
 * The disposable migration harness audits the policy with its own probe. This
 * script reaches the same conclusion with a different instrument: it applies the
 * canonical chain through the harness, keeps the container, then runs the Gate D
 * inventory SQL against the migrated schema and compares the privileges the
 * inventory observes against docs/database/table-access-policy.json.
 *
 * Two instruments agreeing is evidence; one instrument agreeing with itself is
 * not. Any disagreement is reported per table and per role.
 *
 * Isolation follows the harness: digest-pinned image, network none, no published
 * ports, no host mounts, teardown by container id. No staging or production
 * credential is present and no application or student data is used.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { validate } = require("./validate-migrations-disposable");
const { APPROVED_SUPABASE_IMAGE } = require("./lib/disposable-migration-container");

const ROOT = path.join(__dirname, "..");
const CONTAINER = `tm-migval-gated-${process.pid}`;
const INVENTORY = path.join(__dirname, "sql", "gate-d-security-inventory.sql");
const MANIFEST = path.join(ROOT, "docs", "database", "table-access-policy.json");

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

/** Normalise a privilege list so manifest and catalog casing cannot diverge. */
function normalisePrivileges(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value).trim().toUpperCase())
    .sort();
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
      keepContainer: true
    });

    check(
      "harness: canonical chain applied and its own policy audit passed",
      result.ok === true,
      `${result.reason} ${JSON.stringify(result.steps.filter((step) => !step.ok))}`
    );

    const start = result.steps.find((step) => step.name === "start");
    containerId = start && start.detail ? String(start.detail).trim() : null;
    teardownNeeded = Boolean(containerId);

    check("harness: container kept for the cross-check", Boolean(containerId));

    if (!result.ok || !containerId) {
      return 1;
    }

    const copy = docker(["cp", INVENTORY, `${containerId}:/work/inventory.sql`]);

    check(
      "cross-check: inventory SQL copied into the migrated container",
      copy.exitCode === 0,
      copy.stderr.trim()
    );

    const inventory = docker([
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
      "-At",
      "-f",
      "/work/inventory.sql"
    ]);

    check(
      "cross-check: inventory executed against the migrated schema",
      inventory.exitCode === 0,
      (inventory.stderr || "").trim().slice(0, 400)
    );

    if (inventory.exitCode !== 0) {
      return 1;
    }

    const rows = inventory.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line));

    const observed = new Map();

    for (const row of rows.filter((entry) => entry.kind === "table_acl")) {
      observed.set(row.table, {
        anon: normalisePrivileges(row.anon),
        authenticated: normalisePrivileges(row.authenticated)
      });
    }

    const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    const expectedTables = Object.keys(manifest.tables || {});

    check(
      "cross-check: inventory reported every table in the manifest",
      expectedTables.every((name) => observed.has(name)),
      `${observed.size} observed, ${expectedTables.length} expected`
    );

    const mismatches = [];

    for (const name of expectedTables) {
      const seen = observed.get(name);

      if (!seen) {
        mismatches.push(`${name}: not reported by the inventory`);
        continue;
      }

      for (const role of ["anon", "authenticated"]) {
        const expected = normalisePrivileges(manifest.tables[name][role]);
        const actual = seen[role];

        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
          mismatches.push(
            `${name}.${role}: expected ${JSON.stringify(expected)} observed ${JSON.stringify(actual)}`
          );
        }
      }
    }

    check(
      "cross-check: observed privileges match the manifest for every table and role",
      mismatches.length === 0,
      mismatches.slice(0, 8).join(" ; ")
    );

    console.log(
      `  [ok] cross-check: ${expectedTables.length} tables compared across anon and authenticated ` +
        `(${expectedTables.length * 2} role comparisons)`
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
      ? "  GATE D MANIFEST CROSS-CHECK: ALL CHECKS PASSED"
      : `  GATE D MANIFEST CROSS-CHECK: ${failures.length} CHECK(S) FAILED`
  );

  return ok ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`  FAIL  ${error && error.stack ? error.stack : error}`);
    process.exit(1);
  });

