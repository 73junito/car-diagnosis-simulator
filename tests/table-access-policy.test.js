"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  APPLICATION_ROLES,
  buildPolicyProbeArgs,
  evaluatePolicy,
  loadManifest,
  parsePolicyProbe,
  policyProbeSql,
  validateManifest
} = require("../scripts/verify-table-access-policy");

const MANIFEST_PATH = path.join(__dirname, "..", "docs", "database", "table-access-policy.json");

const { verifyManifestConsistency } = require("../scripts/verify-table-access-policy-manifest");
const { dynamicPrivilegeMutations } = require("../scripts/verify-table-access-policy-manifest");

function manifest(tables) {
  return { schemaVersion: 1, tables };
}

function entry(classification, anon = [], authenticated = []) {
  return { classification, anon, authenticated, authority: ["test fixture"] };
}

/** Build a probe result from an explicit list of grant tuples. */
function probe({ roles = [...APPLICATION_ROLES], tables, grants = [] }) {
  const lines = [
    ...roles.map((role) => `role:${role}`),
    ...tables.map((table) => `table:${table}`),
    ...grants.map(([role, table, privilege]) => `grant:${role}|${table}|${privilege}`)
  ];

  return parsePolicyProbe({ exitCode: 0, stdout: lines.join("\n") });
}

function codes(result) {
  return result.violations.map((violation) => violation.code);
}

describe("table access policy audit: approved access passes", () => {
  test("1. approved public (anon) access passes", () => {
    const policy = manifest({ catalog: entry("public-read", ["SELECT"], []) });
    const result = evaluatePolicy({
      manifest: policy,
      probe: probe({ tables: ["catalog"], grants: [["anon", "catalog", "SELECT"]] })
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.summary.roleComparisons).toBe(2);
  });

  test("2. required authenticated access passes", () => {
    const policy = manifest({ classes: entry("authenticated-granted", [], ["SELECT", "INSERT"]) });
    const result = evaluatePolicy({
      manifest: policy,
      probe: probe({
        tables: ["classes"],
        grants: [
          ["authenticated", "classes", "SELECT"],
          ["authenticated", "classes", "INSERT"]
        ]
      })
    });

    expect(result.ok).toBe(true);
  });

  test("9. a deliberate privilege restriction is accepted", () => {
    const policy = manifest({ attempts: entry("service-role-only") });
    const result = evaluatePolicy({ manifest: policy, probe: probe({ tables: ["attempts"] }) });

    expect(result.ok).toBe(true);
  });
});

describe("table access policy audit: failures are observable", () => {
  test("3. a missing required privilege fails", () => {
    const policy = manifest({ classes: entry("authenticated-granted", [], ["SELECT", "INSERT"]) });
    const result = evaluatePolicy({
      manifest: policy,
      probe: probe({ tables: ["classes"], grants: [["authenticated", "classes", "SELECT"]] })
    });

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("MISSING_PRIVILEGE");
    expect(result.violations[0].detail).toContain("INSERT");
  });

  test("4. an unauthorized grant on a service-role-only table fails", () => {
    const policy = manifest({ attempts: entry("service-role-only") });
    const result = evaluatePolicy({
      manifest: policy,
      probe: probe({ tables: ["attempts"], grants: [["authenticated", "attempts", "SELECT"]] })
    });

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("EXCESSIVE_PRIVILEGE");
  });

  test("4b. an unauthorized anon grant fails", () => {
    const policy = manifest({ attempts: entry("service-role-only") });
    const result = evaluatePolicy({
      manifest: policy,
      probe: probe({ tables: ["attempts"], grants: [["anon", "attempts", "SELECT"]] })
    });

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("EXCESSIVE_PRIVILEGE");
  });

  test("5. a missing expected role fails", () => {
    const policy = manifest({ attempts: entry("service-role-only") });
    const result = evaluatePolicy({
      manifest: policy,
      probe: probe({ roles: ["authenticated"], tables: ["attempts"] })
    });

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("ROLE_MISSING");
  });

  test("6. a table present in the database but absent from the manifest fails", () => {
    const policy = manifest({ attempts: entry("service-role-only") });
    const result = evaluatePolicy({ manifest: policy, probe: probe({ tables: ["attempts", "surprise"] }) });

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("UNCLASSIFIED_OBJECT");
    expect(result.violations.find((v) => v.code === "UNCLASSIFIED_OBJECT").detail).toContain("surprise");
  });

  test("6b. an unresolved classification fails the manifest itself", () => {
    const policy = manifest({ mystery: entry("unclassified") });

    expect(validateManifest(policy).join(" ")).toContain("unresolved");

    const result = evaluatePolicy({ manifest: policy, probe: probe({ tables: ["mystery"] }) });

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("MANIFEST_INVALID");
  });

  test("7. a manifest object missing from the database fails", () => {
    const policy = manifest({
      attempts: entry("service-role-only"),
      vanished: entry("service-role-only")
    });
    const result = evaluatePolicy({ manifest: policy, probe: probe({ tables: ["attempts"] }) });

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("MISSING_OBJECT");
  });

  test("8. a SQL execution error fails", () => {
    const result = evaluatePolicy({
      manifest: manifest({ attempts: entry("service-role-only") }),
      probe: parsePolicyProbe({ exitCode: 3, stdout: "" })
    });

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("PROBE_FAILED");
  });

  test("a zero-object probe cannot pass, because nothing was verified", () => {
    const result = evaluatePolicy({
      manifest: manifest({ attempts: entry("service-role-only") }),
      probe: probe({ tables: [] })
    });

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("NO_OBJECTS_CHECKED");
    expect(codes(result)).toContain("MISSING_OBJECT");
  });
});

describe("table access policy audit: manifest integrity", () => {
  test("rejects a malformed or empty manifest", () => {
    expect(validateManifest(null).join(" ")).toContain("missing");
    expect(validateManifest({ schemaVersion: 99, tables: {} }).join(" ")).toContain("schemaVersion");
    expect(validateManifest({ schemaVersion: 1, tables: {} }).join(" ")).toContain("no tables");
    expect(
      validateManifest(
        manifest({ a: { classification: "nope", anon: [], authenticated: [], authority: ["x"] } })
      ).join(" ")
    ).toContain("unknown classification");
    expect(
      validateManifest(manifest({ a: { classification: "service-role-only", anon: [], authenticated: [] } })).join(" ")
    ).toContain("authority");
  });

  test("the committed manifest is structurally valid and cites an authority for every table", () => {
    const committed = loadManifest(MANIFEST_PATH);
    const problems = validateManifest(committed);

    // Unresolved classifications are reported, never hidden: the only acceptable
    // problem is the unresolved-classification finding itself.
    expect(problems.filter((problem) => !problem.includes("unresolved"))).toEqual([]);
    expect(Object.keys(committed.tables).length).toBeGreaterThan(50);

    for (const table of Object.values(committed.tables)) {
      expect(Array.isArray(table.anon)).toBe(true);
      expect(Array.isArray(table.authenticated)).toBe(true);
      expect(table.authority.length).toBeGreaterThan(0);
    }
  });

  test("10. the manifest covers every canonical public table created by the chain", () => {
    const committed = loadManifest(MANIFEST_PATH);
    const migrationDir = path.join(__dirname, "..", "supabase", "migrations");
    const created = new Set();

    for (const file of fs.readdirSync(migrationDir).filter((name) => name.endsWith(".sql"))) {
      const sql = fs.readFileSync(path.join(migrationDir, file), "utf8");

      for (const match of sql.matchAll(/create table(?: if not exists)?\s+public\.([a-z0-9_]+)/gi)) {
        created.add(match[1].toLowerCase());
      }
    }

    expect(created.size).toBeGreaterThan(50);
    expect([...created].filter((table) => !(table in committed.tables))).toEqual([]);
  });

  test("the probe is read-only and fails closed", () => {
    const args = buildPolicyProbeArgs({ databaseUrl: "postgres://u@127.0.0.1:5432/postgres" });
    const sql = policyProbeSql().toLowerCase();
    // Assert against statements, not string literals: the probe legitimately
    // emits row labels such as 'grant:'.
    const statementsOnly = sql.replace(/'[^']*'/g, "''");

    expect(args).toContain("ON_ERROR_STOP=1");
    expect(args).toContain("--no-psqlrc");
    expect(args).not.toContain("-f");
    expect(statementsOnly).not.toMatch(/\b(insert|update|delete|drop|alter|create|grant|revoke)\b/);
    expect(sql).toContain("information_schema");
  });
});

describe("table access policy manifest: deterministic consistency verification", () => {
  test("the committed manifest is consistent with its declared migration sources", () => {
    const result = verifyManifestConsistency();

    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.tableCount).toBeGreaterThan(50);
  });

  test("detects a canonical table missing from the manifest", () => {
    const manifest = loadManifest(MANIFEST_PATH);
    delete manifest.tables.attempts;

    const result = verifyManifestConsistency({ manifest });

    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("missing table: public.attempts");
  });

  test("detects an unknown policy entry", () => {
    const manifest = loadManifest(MANIFEST_PATH);
    manifest.tables.invented_table = {
      classification: "service-role-only",
      anon: [],
      authenticated: [],
      authority: ["invented"]
    };

    const result = verifyManifestConsistency({ manifest });

    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("unknown policy entry: public.invented_table");
  });

  test("detects an unsupported privilege and an invalid classification", () => {
    const manifest = loadManifest(MANIFEST_PATH);
    manifest.tables.attempts.authenticated = ["OWNERSHIP"];
    manifest.tables.attempts.classification = "not-a-classification";

    const result = verifyManifestConsistency({ manifest });

    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("unsupported privilege");
    expect(result.problems.join(" ")).toContain("unknown classification");
  });

  test("detects a policy that contradicts its source without an owner decision", () => {
    const manifest = loadManifest(MANIFEST_PATH);
    // classes is granted SELECT/INSERT/UPDATE/DELETE by the canonical chain.
    manifest.tables.classes.authenticated = ["SELECT"];
    manifest.tables.classes.authority = ["test fixture"];

    const result = verifyManifestConsistency({ manifest });

    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("source mismatch: public.classes.authenticated");
    expect(result.problems.join(" ")).toContain("no owner decision is recorded");
  });

  test("accepts a narrowed policy when an owner decision is recorded", () => {
    const manifest = loadManifest(MANIFEST_PATH);
    manifest.tables.classes.authenticated = ["SELECT"];
    manifest.tables.classes.authority = ["owner decision: reduced for this review"];

    const result = verifyManifestConsistency({ manifest });

    expect(result.problems.join(" ")).not.toContain("source mismatch");
  });
});

describe("table access policy manifest: dynamic SQL guard", () => {
  function fixtureRoot(migrations) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "policy-dynamic-"));
    const directory = path.join(root, "supabase", "migrations");

    fs.mkdirSync(directory, { recursive: true });

    for (const [name, sql] of Object.entries(migrations)) {
      fs.writeFileSync(path.join(directory, name), sql, "utf8");
    }

    return root;
  }

  test("detects a dynamic GRANT that names a client role", () => {
    const root = fixtureRoot({
      "20260101000000_dynamic.sql": [
        "do $$",
        "begin",
        "  execute 'grant select on table public.attempts to authenticated';",
        "end $$;"
      ].join("\n")
    });

    const findings = dynamicPrivilegeMutations(root);

    expect(findings).toHaveLength(1);
    expect(findings[0].mentionsClientRole).toBe(true);
    expect(findings[0].sql).toContain("authenticated");
  });

  test("records but does not flag a dynamic grant that names only service_role", () => {
    const root = fixtureRoot({
      "20260101000000_service.sql": [
        "do $$",
        "begin",
        "  execute 'grant all privileges on table public.widgets to service_role';",
        "end $$;"
      ].join("\n")
    });

    const findings = dynamicPrivilegeMutations(root);

    expect(findings).toHaveLength(1);
    expect(findings[0].mentionsClientRole).toBe(false);
  });

  test("fails closed when a migration mutates client privileges dynamically", () => {
    const root = fixtureRoot({
      "20260101000000_dynamic.sql": [
        "create table if not exists public.widgets (id int primary key);",
        "do $$",
        "begin",
        "  execute 'grant select on table public.widgets to anon';",
        "end $$;"
      ].join("\n")
    });
    const manifest = {
      schemaVersion: 1,
      tables: {
        widgets: {
          classification: "service-role-only",
          anon: [],
          authenticated: [],
          authority: ["test fixture"]
        }
      }
    };

    const result = verifyManifestConsistency({ rootDirectory: root, manifest });

    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("dynamic privilege escalation");
  });

  test("does not fail on a dynamic REVOKE, which can only reduce access", () => {
    const root = fixtureRoot({
      "20260101000000_revoke.sql": [
        "create table if not exists public.widgets (id int primary key);",
        "do $$",
        "begin",
        "  execute 'revoke all privileges on table public.widgets from anon, authenticated';",
        "end $$;"
      ].join("\n")
    });
    const manifest = {
      schemaVersion: 1,
      tables: {
        widgets: {
          classification: "service-role-only",
          anon: [],
          authenticated: [],
          authority: ["test fixture"]
        }
      }
    };

    const result = verifyManifestConsistency({ rootDirectory: root, manifest });

    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
  });

  test("the canonical chain contains no dynamic client privilege escalation", () => {
    const findings = dynamicPrivilegeMutations(path.join(__dirname, ".."));

    expect(findings.filter((finding) => finding.escalates)).toEqual([]);

    // The three informational revokes found in the canonical chain: they reduce
    // client access on legacy objects, so they are recorded, not fatal.
    const informational = findings.filter((finding) => finding.mentionsClientRole);

    expect(informational.every((finding) => finding.kind === "revoke")).toBe(true);
  });
});
