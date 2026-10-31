"use strict";

/*
 * Gate D: execute scripts/sql/gate-d-security-inventory.sql against an isolated
 * PostgreSQL 17 instance carrying synthetic objects, and assert the inventory
 * reports every category it claims to report - table grants, column privileges,
 * default ACLs, sequences, views, routines and SECURITY DEFINER metadata - with
 * both positive and negative cases.
 *
 * Isolation follows the disposable migration harness: the approved digest-pinned
 * Supabase PostgreSQL 17 image, `--network none`, no published ports, no host
 * mounts, SQL reaching the container through `docker cp`, and teardown by
 * container id. No staging or production credential is present and no
 * application or student data is used.
 */

const path = require("path");
const { spawnSync } = require("child_process");

const APPROVED_IMAGE =
  "ghcr.io/supabase/postgres:17.6.1.167@sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb";
const CONTAINER = `tm-gated-inv-${process.pid}`;
const DB_USER = "postgres";
const DB_NAME = "postgres";
const WORK = "/work";

const INVENTORY = path.join(__dirname, "sql", "gate-d-security-inventory.sql");
const FIXTURES = path.join(__dirname, "sql", "gate-d-security-inventory-fixtures.sql");

const failures = [];

function check(label, ok, detail) {
  if (!ok) {
    failures.push(label);
  }

  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? ` -- ${detail}` : ""}`);
}

function bail(message) {
  throw new Error(message);
}

function docker(args) {
  const result = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

  return { exitCode: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function psql(args) {
  return docker([
    "exec",
    CONTAINER,
    "psql",
    "-h",
    "127.0.0.1",
    "-U",
    DB_USER,
    "-d",
    DB_NAME,
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    ...args
  ]);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let containerId = null;
  let started = false;

  try {
    const run = docker([
      "run",
      "-d",
      "--name",
      CONTAINER,
      "--network",
      "none",
      "-e",
      "POSTGRES_PASSWORD=validation-only",
      APPROVED_IMAGE
    ]);

    if (run.exitCode !== 0) {
      bail(`container start failed: ${run.stderr.trim()}`);
    }

    started = true;
    containerId = run.stdout.trim();
    console.log(`  [ok] start: ${containerId.slice(0, 12)}`);

    // Isolation, asserted before anything executes inside the container.
    const inspect = JSON.parse(docker(["inspect", CONTAINER]).stdout)[0];
    const host = inspect.HostConfig || {};

    check("isolation: network none", host.NetworkMode === "none", String(host.NetworkMode));
    check("isolation: no host binds", !Array.isArray(host.Binds) || host.Binds.length === 0);
    check("isolation: no host mounts", !Array.isArray(inspect.Mounts) || inspect.Mounts.length === 0);
    check("isolation: no published ports", Object.keys(host.PortBindings || {}).length === 0);

    const imageInspect = JSON.parse(docker(["image", "inspect", inspect.Image]).stdout)[0];
    const approvedRepoDigest = `ghcr.io/supabase/postgres@${APPROVED_IMAGE.split("@")[1]}`;

    check(
      "isolation: approved image provenance",
      (imageInspect.RepoDigests || []).includes(approvedRepoDigest),
      JSON.stringify(imageInspect.RepoDigests)
    );

    // A stable postmaster, not merely pg_isready: the entrypoint cycles the server
    // while initialising, so the start time must repeat before the instance counts.
    let previousStart = null;
    let ready = false;
    const observations = [];

    for (let attempt = 0; attempt < 90 && !ready; attempt += 1) {
      const probe = psql(["-At", "-c", "select pg_postmaster_start_time()::text"]);
      const start = probe.exitCode === 0 ? probe.stdout.trim() : "";

      observations.push(`#${attempt + 1} rc=${probe.exitCode} start=${start || "(none)"}`);

      if (start && start === previousStart) {
        ready = true;
        break;
      }

      // A transient probe failure must not discard a reading already seen, or the
      // gate can never observe two consecutive identical values.
      previousStart = start || previousStart;

      await sleep(3000);
    }

    check("initialisation: postmaster stable", ready);

    if (!ready) {
      bail(
        `the disposable instance never reached a stable postmaster; last observations: ${observations
          .slice(-6)
          .join(" | ")}`
      );
    }

    docker(["exec", CONTAINER, "mkdir", "-p", WORK]);
    docker(["cp", FIXTURES, `${CONTAINER}:${WORK}/fixtures.sql`]);
    docker(["cp", INVENTORY, `${CONTAINER}:${WORK}/inventory.sql`]);

    const fixtures = psql(["-f", `${WORK}/fixtures.sql`]);

    if (fixtures.exitCode !== 0) {
      bail(`fixtures failed: ${(fixtures.stderr || "").trim().slice(0, 600)}`);
    }

    console.log("  [ok] fixtures: synthetic objects created");

    const inventory = psql(["-At", "-f", `${WORK}/inventory.sql`]);

    if (inventory.exitCode !== 0) {
      bail(`inventory failed: ${(inventory.stderr || "").trim().slice(0, 600)}`);
    }

    console.log("  [ok] inventory: executed successfully against isolated PostgreSQL 17");

    // psql still emits command tags such as BEGIN and ROLLBACK, so only the JSON
    // evidence rows are parsed. Anything malformed among them throws and is
    // reported rather than ignored.
    const rows = inventory.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line));

    const byKind = (kind) => rows.filter((row) => row.kind === kind);
    const one = (kind, predicate) => byKind(kind).find(predicate);

    for (const kind of [
      "target",
      "table_acl",
      "default_acl",
      "sequence_acl",
      "routine_acl",
      "column_acl",
      "view_security"
    ]) {
      check(`emits '${kind}' evidence`, byKind(kind).length > 0);
    }

    const target = one("target", () => true);

    check(
      "target: read-only transaction on the expected database and user",
      Boolean(target) &&
        target.read_only === "on" &&
        target.database === DB_NAME &&
        target.database_user === DB_USER &&
        String(target.server_version).startsWith("17"),
      JSON.stringify(target)
    );

    const grantedTable = one("table_acl", (row) => row.table === "gd_granted_table");

    check(
      "table_acl: anon grant reported",
      Boolean(grantedTable) && grantedTable.anon.includes("SELECT"),
      JSON.stringify(grantedTable)
    );
    check(
      "table_acl: authenticated grants reported",
      Boolean(grantedTable) &&
        ["DELETE", "INSERT", "SELECT", "UPDATE"].every((privilege) =>
          grantedTable.authenticated.includes(privilege)
        ),
      JSON.stringify(grantedTable)
    );
    check(
      "table_acl: owner and RLS state reported",
      Boolean(grantedTable) && grantedTable.owner === DB_USER && grantedTable.rls === false,
      JSON.stringify(grantedTable)
    );

    const ungrantedTable = one("table_acl", (row) => row.table === "gd_ungranted_table");

    check(
      "table_acl negative: a public table with no role privilege reports empty lists",
      Boolean(ungrantedTable) && ungrantedTable.anon.length === 0 && ungrantedTable.authenticated.length === 0,
      JSON.stringify(ungrantedTable)
    );

    const grantedColumn = one(
      "column_acl",
      (row) => row.table === "gd_column_table" && row.column === "public_col"
    );

    check(
      "column_acl: column-level grant reported",
      Boolean(grantedColumn) && grantedColumn.grantee === "authenticated" && grantedColumn.privilege === "SELECT",
      JSON.stringify(grantedColumn)
    );
    check(
      "column_acl negative: an ungranted column is not reported",
      one("column_acl", (row) => row.column === "private_col") === undefined
    );

    // A sequence carries one row per privilege, so assert over the whole set
    // rather than the first matching row.
    const sequenceGrants = byKind("sequence_acl")
      .filter((row) => row.sequence === "gd_granted_seq" && row.grantee === "authenticated")
      .map((row) => row.privilege);

    check(
      "sequence_acl: sequence grants reported",
      ["SELECT", "USAGE"].every((privilege) => sequenceGrants.includes(privilege)),
      JSON.stringify(sequenceGrants)
    );
    check(
      "sequence_acl negative: a sequence with no grant is not reported",
      one("sequence_acl", (row) => row.sequence === "gd_ungranted_seq") === undefined
    );

    const definerRoutine = one("routine_acl", (row) => row.routine === "gd_security_definer_fn");

    check(
      "routine_acl: SECURITY DEFINER metadata and grant reported",
      Boolean(definerRoutine) &&
        definerRoutine.security_definer === true &&
        definerRoutine.grantee === "anon" &&
        definerRoutine.privilege === "EXECUTE",
      JSON.stringify(definerRoutine)
    );
    check(
      "routine_acl negative: a routine with no grant is not reported",
      one("routine_acl", (row) => row.routine === "gd_invoker_fn") === undefined
    );

    const invokerView = one("view_security", (row) => row.view === "gd_invoker_view");

    check(
      "view_security: security_invoker and effective select rights reported",
      Boolean(invokerView) &&
        invokerView.security_invoker === true &&
        invokerView.authenticated_select === true &&
        invokerView.anon_select === false,
      JSON.stringify(invokerView)
    );

    const definerView = one("view_security", (row) => row.view === "gd_definer_view");

    check(
      "view_security negative: a definer view with no role select",
      Boolean(definerView) &&
        definerView.security_invoker === false &&
        definerView.anon_select === false &&
        definerView.authenticated_select === false,
      JSON.stringify(definerView)
    );

    check(
      "default_acl: default privileges for future tables reported",
      Boolean(
        one(
          "default_acl",
          (row) => row.object_type === "r" && row.grantee === "anon" && row.privilege === "SELECT"
        )
      ),
      JSON.stringify(byKind("default_acl").slice(0, 4))
    );
  } catch (error) {
    check(`execution: ${error && error.message ? error.message : error}`, false);
  } finally {
    if (started) {
      docker(["rm", "-f", containerId || CONTAINER]);

      const remaining = docker(["ps", "-a", "--filter", `id=${containerId}`, "-q"]).stdout.trim();

      check("teardown: disposable container removed", remaining === "");
    }
  }

  const ok = failures.length === 0;

  console.log(
    ok
      ? "  GATE D INVENTORY VALIDATION: ALL CHECKS PASSED"
      : `  GATE D INVENTORY VALIDATION: ${failures.length} CHECK(S) FAILED`
  );

  return ok ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`  FAIL  ${error && error.stack ? error.stack : error}`);
    process.exit(1);
  });

