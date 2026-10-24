"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  AUDITED_ROLES,
  AUDIT_OUTCOMES,
  DEFAULT_MIGRATIONS_DIRECTORY,
  FAILURE_REASONS,
  LEGACY_MIGRATIONS_DIRECTORY,
  buildPsqlArgs,
  buildRolePreconditionArgs,
  classifyAuditOutcome,
  classifyMigrationsDirectory,
  classifyRolePrecondition,
  discoverMigrationFiles,
  normalizeMigrationDirectory,
  parseDatabaseTarget,
  redactDatabaseUrl,
  rolePreconditionSql,
  runApply,
  runAudit,
  runValidation
} = require("../scripts/lib/disposable-migration-validation");

const LOCAL_DSN = "postgres://postgres:postgres@localhost:5432/postgres";
const PRODUCTION_DSN = "postgres://user:secret@db.abcdefghijklmnop.supabase.co:5432/postgres";

const WORKFLOW_PATH = path.join(__dirname, "..", ".github", "workflows", "apply-migrations.yml");

/** The exact suppression the workflow used before this change. */
const LEGACY_FAIL_OPEN_LINE =
  '          psql "$DATABASE_URL" -At -F"," -f db/scripts/grants_audit.sql > /tmp/grants_audit.out || true';

function readWorkflow() {
  return fs.readFileSync(WORKFLOW_PATH, "utf8");
}

/**
 * Workflow lines that are not comments. Comment text is documentation, so it
 * must never satisfy or trip an assertion about executable content.
 */
function executableLines(content) {
  return content.split(/\r?\n/).filter((line) => !/^\s*#/.test(line));
}

/**
 * Lines that actually invoke psql, as opposed to YAML metadata that merely
 * mentions it (for example the step name `- name: Install psql client`).
 */
function psqlInvocations(content) {
  return executableLines(content).filter(
    (line) => !/^\s*-?\s*[A-Za-z][A-Za-z_-]*:\s/.test(line) && /\bpsql\b/.test(line)
  );
}

/** Any executable line that runs a SQL file through psql. */
function psqlFileInvocations(content) {
  return psqlInvocations(content).filter((line) => /-f\b/.test(line));
}

/** Any unconditional suppression of a command's failure status. */
function hasSuppressedFailure(content) {
  return executableLines(content).some((line) => /\|\|\s*true/.test(line));
}

/**
 * Top-level `permissions:` scopes as `scope:level` strings. Stops at the next
 * unindented key, so job-level permissions are not confused with workflow-level
 * ones.
 */
function topLevelPermissions(content) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^permissions:\s*$/.test(line));

  if (start === -1) {
    return [];
  }

  const scopes = [];

  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\S/.test(lines[index])) {
      break;
    }

    const match = lines[index].match(/^\s+([a-z-]+):\s*(\S+)/);

    if (match) {
      scopes.push(`${match[1]}:${match[2]}`);
    }
  }

  return scopes;
}

function createExec(handler) {
  const calls = [];
  const exec = (args, context) => {
    calls.push({ args, context });
    return handler({ args, context, callIndex: calls.length - 1 });
  };

  return { exec, calls };
}

function succeedingExec() {
  return createExec(() => ({ exitCode: 0, stdout: "", stderr: "" }));
}

/**
 * Executor that answers per phase, so the role precondition and the grants audit
 * can be scripted independently. Defaults to a healthy environment where both
 * audited roles exist.
 */
function phaseAwareExec({
  roles = ["anon", "authenticated"],
  audit = { exitCode: 0, stdout: "", stderr: "" },
  apply = { exitCode: 0, stdout: "", stderr: "" }
} = {}) {
  return createExec(({ context }) => {
    if (context.phase === "role-precondition") {
      return { exitCode: 0, stdout: roles.length ? `${roles.join("\n")}\n` : "", stderr: "" };
    }

    if (context.phase === "audit") {
      return audit;
    }

    return apply;
  });
}

function captureLogs() {
  const out = [];
  const err = [];

  return { out, err, log: (message) => out.push(message), logError: (message) => err.push(message) };
}

function makeMigrations(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "disposable-migration-"));

  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), content, "utf8");
  }

  return root;
}

const seeded = {
  "20260101_first.sql": "select 1;\n",
  "20260102_second.sql": "select 2;\n"
};

describe("disposable migration validation: fail-closed application", () => {
  test("applies every migration in sorted order with ON_ERROR_STOP enabled", () => {
    const directory = makeMigrations({ ...seeded, "notes.txt": "not sql\n" });
    const { exec, calls } = succeedingExec();

    const result = runApply({ databaseUrl: LOCAL_DSN, migrationsDirectory: directory, exec });

    expect(result.ok).toBe(true);
    expect(result.applied).toEqual(["20260101_first.sql", "20260102_second.sql"]);

    for (const call of calls) {
      expect(call.args).toContain("-v");
      expect(call.args).toContain("ON_ERROR_STOP=1");
      expect(call.args).toContain("--no-psqlrc");
      expect(call.args).toContain(LOCAL_DSN);
    }

    expect(calls[0].args[calls[0].args.indexOf("-f") + 1]).toBe(
      path.join(directory, "20260101_first.sql")
    );
    expect(calls[1].args[calls[1].args.indexOf("-f") + 1]).toBe(
      path.join(directory, "20260102_second.sql")
    );
  });

  test("fails when a migration contains invalid SQL and applies no later migration", () => {
    const directory = makeMigrations({
      "a.sql": "select 1;\n",
      "b_bad.sql": "this is not sql;\n",
      "c.sql": "select 3;\n"
    });
    const { exec, calls } = createExec(({ context }) =>
      context.file === "b_bad.sql"
        ? { exitCode: 3, stdout: "", stderr: 'psql:b_bad.sql:2: ERROR:  syntax error at or near "is"\n' }
        : { exitCode: 0, stdout: "", stderr: "" }
    );
    const logs = captureLogs();

    const result = runApply({
      databaseUrl: LOCAL_DSN,
      migrationsDirectory: directory,
      exec,
      log: logs.log,
      logError: logs.logError
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.MIGRATION_FAILED);
    expect(result.failedFile).toBe("b_bad.sql");
    expect(result.applied).toEqual(["a.sql"]);
    expect(calls.map((call) => call.context.file)).toEqual(["a.sql", "b_bad.sql"]);
    expect(logs.err.join("\n")).toContain("exited with status 3");
    expect(logs.err.join("\n")).toContain("syntax error");
  });

  test("fails when no migration file is discovered instead of passing without applying anything", () => {
    const directory = makeMigrations({ "readme.md": "no sql here\n" });
    const { exec, calls } = succeedingExec();

    const result = runApply({ databaseUrl: LOCAL_DSN, migrationsDirectory: directory, exec });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.NO_MIGRATIONS);
    expect(result.applied).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  test("treats a missing migration directory as no migrations rather than as success", () => {
    const { exec, calls } = succeedingExec();
    const missing = path.join(makeMigrations({}), "does-not-exist");

    expect(discoverMigrationFiles(missing)).toEqual([]);

    const result = runApply({ databaseUrl: LOCAL_DSN, migrationsDirectory: missing, exec });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.NO_MIGRATIONS);
    expect(calls).toHaveLength(0);
  });

  test("treats an executor that reports no exit status as a failure", () => {
    const directory = makeMigrations(seeded);
    const { exec } = createExec(() => ({}));

    const result = runApply({ databaseUrl: LOCAL_DSN, migrationsDirectory: directory, exec });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.MIGRATION_FAILED);
  });
});

describe("disposable migration validation: grants audit outcomes stay distinct", () => {
  test("treats a failed audit query as a failure, not as a clean audit", () => {
    // This is the regression the previous `|| true` introduced: psql failed,
    // wrote nothing to the output file, and the shell reported success.
    const { exec } = phaseAwareExec({
      audit: {
        exitCode: 1,
        stdout: "",
        stderr: 'psql:db/scripts/grants_audit.sql:5: ERROR:  permission denied for schema public\n'
      }
    });
    const logs = captureLogs();

    const result = runAudit({ databaseUrl: LOCAL_DSN, exec, log: logs.log, logError: logs.logError });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.AUDIT_FAILED);
    expect(result.audit.outcome).toBe(AUDIT_OUTCOMES.AUDIT_FAILED);
    expect(result.audit.outcome).not.toBe(AUDIT_OUTCOMES.CLEAN);
    expect(logs.err.join("\n")).toContain("not an empty audit result");
    expect(logs.err.join("\n")).toContain("permission denied");
  });

  test("fails when the audit reports missing privileges", () => {
    const rows = [
      "table,public,attempts,authenticated",
      "sequence,public,attempts_id_seq,authenticated"
    ].join("\n");
    const { exec, calls } = phaseAwareExec({
      audit: { exitCode: 0, stdout: `${rows}\n`, stderr: "" }
    });
    const logs = captureLogs();

    const result = runAudit({ databaseUrl: LOCAL_DSN, exec, log: logs.log, logError: logs.logError });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.MISSING_GRANTS);
    expect(result.audit.outcome).toBe(AUDIT_OUTCOMES.MISSING_GRANTS);
    expect(result.audit.rows).toHaveLength(2);
    expect(logs.err.join("\n")).toContain("2 missing required Data API grant row(s)");

    const auditCall = calls.find((call) => call.context.phase === "audit");

    expect(auditCall.args).toEqual(expect.arrayContaining(["-A", "-t", "-F", ","]));
    expect(auditCall.args).toContain("ON_ERROR_STOP=1");
  });

  test("passes only when the audit query succeeds and returns no rows", () => {
    for (const stdout of ["", "\n", "   \n"]) {
      const { exec } = phaseAwareExec({ audit: { exitCode: 0, stdout, stderr: "" } });

      const result = runAudit({ databaseUrl: LOCAL_DSN, exec });

      expect(result.ok).toBe(true);
      expect(result.audit.outcome).toBe(AUDIT_OUTCOMES.CLEAN);
    }
  });

  test("classifies the three outcomes and never treats a failure as clean", () => {
    expect(classifyAuditOutcome({ exitCode: 0, stdout: "" }).outcome).toBe(AUDIT_OUTCOMES.CLEAN);
    expect(classifyAuditOutcome({ exitCode: 0, stdout: "table,public,t,anon" }).outcome).toBe(
      AUDIT_OUTCOMES.MISSING_GRANTS
    );
    expect(classifyAuditOutcome({ exitCode: 3, stdout: "" }).outcome).toBe(AUDIT_OUTCOMES.AUDIT_FAILED);
    expect(classifyAuditOutcome({ exitCode: 2, stdout: "" }).outcome).toBe(AUDIT_OUTCOMES.AUDIT_FAILED);
    expect(classifyAuditOutcome({ exitCode: 1, stdout: "table,public,t,anon" }).outcome).toBe(
      AUDIT_OUTCOMES.AUDIT_FAILED
    );
  });

  test("stops before the audit when migration application fails", () => {
    const directory = makeMigrations({ "a.sql": "select 1;\n" });
    const { exec, calls } = createExec(() => ({ exitCode: 3, stdout: "", stderr: "boom\n" }));

    const result = runValidation({ databaseUrl: LOCAL_DSN, migrationsDirectory: directory, exec });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.MIGRATION_FAILED);
    expect(result.audit).toBeNull();
    expect(calls.every((call) => call.context.phase === "apply")).toBe(true);
  });
});

describe("disposable migration validation: role precondition", () => {
  test("passes and proceeds to the audit when every audited role exists", () => {
    const { exec, calls } = phaseAwareExec();

    const result = runAudit({ databaseUrl: LOCAL_DSN, exec });

    expect(result.ok).toBe(true);
    expect(result.precondition.ok).toBe(true);
    expect(result.precondition.present).toEqual(["anon", "authenticated"]);
    expect(result.precondition.missing).toEqual([]);
    expect(result.audit.outcome).toBe(AUDIT_OUTCOMES.CLEAN);
    expect(result.audit.presentRoles).toEqual(["anon", "authenticated"]);
    expect(calls.map((call) => call.context.phase)).toEqual(["role-precondition", "audit"]);
  });

  test("refuses to report a clean audit when the audited roles are absent", () => {
    // The exact vacuous case: the audit SQL returns zero rows because it skips
    // every query when a role is absent. That must never be reported as clean.
    const { exec, calls } = phaseAwareExec({ roles: [], audit: { exitCode: 0, stdout: "", stderr: "" } });
    const logs = captureLogs();

    const result = runAudit({ databaseUrl: LOCAL_DSN, exec, log: logs.log, logError: logs.logError });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.ROLES_MISSING);
    expect(result.audit.outcome).toBe(AUDIT_OUTCOMES.ROLES_MISSING);
    expect(result.audit.outcome).not.toBe(AUDIT_OUTCOMES.CLEAN);
    expect([...result.audit.missingRoles].sort()).toEqual(["anon", "authenticated"]);
    expect(result.audit.rows).toEqual([]);
    // the audit query must not even run
    expect(calls.map((call) => call.context.phase)).toEqual(["role-precondition"]);
    expect(logs.err.join("\n")).toContain("NOT APPLICABLE");
    expect(logs.err.join("\n")).toContain("vacuous");
  });

  test("names exactly which audited role is missing", () => {
    const { exec } = phaseAwareExec({ roles: ["authenticated"] });

    const result = runAudit({ databaseUrl: LOCAL_DSN, exec });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.ROLES_MISSING);
    expect(result.audit.missingRoles).toEqual(["anon"]);
    expect(result.audit.presentRoles).toEqual(["authenticated"]);
    expect(result.message).toContain("anon");
  });

  test("keeps a failed role query distinct from missing roles and from missing grants", () => {
    const { exec } = createExec(() => ({ exitCode: 1, stdout: "", stderr: "connection refused\n" }));

    const result = runAudit({ databaseUrl: LOCAL_DSN, exec });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.ROLE_CHECK_FAILED);
    expect(result.audit.outcome).toBe(AUDIT_OUTCOMES.ROLE_CHECK_FAILED);
    expect(result.reason).not.toBe(FAILURE_REASONS.ROLES_MISSING);
    expect(result.reason).not.toBe(FAILURE_REASONS.MISSING_GRANTS);
    expect(result.reason).not.toBe(FAILURE_REASONS.AUDIT_FAILED);
  });

  test("classifies the precondition states directly", () => {
    expect(classifyRolePrecondition({ exitCode: 0, stdout: "anon\nauthenticated\n" }).ok).toBe(true);
    expect(classifyRolePrecondition({ exitCode: 0, stdout: "authenticated\n" }).missing).toEqual(["anon"]);
    expect([...classifyRolePrecondition({ exitCode: 0, stdout: "" }).missing].sort()).toEqual([
      "anon",
      "authenticated"
    ]);
    expect(classifyRolePrecondition({ exitCode: 2, stdout: "" }).reason).toBe(
      FAILURE_REASONS.ROLE_CHECK_FAILED
    );
  });

  test("the precondition query is read-only and fails closed", () => {
    const args = buildRolePreconditionArgs({ databaseUrl: LOCAL_DSN });
    const sql = rolePreconditionSql();

    expect(args).toContain("ON_ERROR_STOP=1");
    expect(args).toContain("--no-psqlrc");
    expect(args).toContain("-c");
    expect(args).not.toContain("-f");
    expect(sql.toLowerCase()).toContain("select");
    expect(sql.toLowerCase()).not.toMatch(/\b(insert|update|delete|drop|alter|create|grant|revoke)\b/);
    expect(sql).toContain("pg_roles");
  });

  test("drift guard: AUDITED_ROLES matches the roles named in grants_audit.sql", () => {
    const auditSql = fs.readFileSync(
      path.join(__dirname, "..", "db", "scripts", "grants_audit.sql"),
      "utf8"
    );
    const namedRoles = [
      ...new Set([...auditSql.matchAll(/rolname\s*=\s*'([^']+)'/g)].map((match) => match[1]))
    ].sort();

    expect(namedRoles.length).toBeGreaterThan(0);
    expect([...AUDITED_ROLES].sort()).toEqual(namedRoles);
  });
});

describe("disposable migration validation: target authorisation", () => {
  const refused = [
    ["supabase staging host", "postgres://u:p@db.abcdefghijklmnop.supabase.co:5432/postgres"],
    ["supabase pooler", "postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres"],
    ["private network address", "postgres://u:p@10.0.0.5:5432/postgres"],
    ["internal hostname", "postgres://u:p@staging.internal:5432/postgres"]
  ];

  test("refuses every non-disposable target before executing any statement", () => {
    const directory = makeMigrations(seeded);

    for (const [label, dsn] of refused) {
      const target = parseDatabaseTarget(dsn);

      expect(`${label}:${target.ok}`).toBe(`${label}:false`);
      expect(target.reason).toBe(FAILURE_REASONS.NON_DISPOSABLE_TARGET);

      const { exec, calls } = succeedingExec();
      const apply = runApply({ databaseUrl: dsn, migrationsDirectory: directory, exec });
      const audit = runAudit({ databaseUrl: dsn, exec });

      expect(apply.ok).toBe(false);
      expect(apply.reason).toBe(FAILURE_REASONS.NON_DISPOSABLE_TARGET);
      expect(audit.ok).toBe(false);
      expect(audit.reason).toBe(FAILURE_REASONS.NON_DISPOSABLE_TARGET);
      expect(calls).toHaveLength(0);
    }
  });

  test("accepts only loopback targets", () => {
    for (const dsn of [
      LOCAL_DSN,
      "postgres://u:p@127.0.0.1:5432/postgres",
      "postgres://u:p@[::1]:5432/postgres",
      "postgresql://u:p@localhost:5432/postgres"
    ]) {
      expect(`${dsn}:${parseDatabaseTarget(dsn).ok}`).toBe(`${dsn}:true`);
    }
  });

  test("rejects a missing, malformed, or non-postgres DSN", () => {
    expect(parseDatabaseTarget(undefined).reason).toBe(FAILURE_REASONS.MISSING_DATABASE_URL);
    expect(parseDatabaseTarget("").reason).toBe(FAILURE_REASONS.MISSING_DATABASE_URL);
    expect(parseDatabaseTarget("   ").reason).toBe(FAILURE_REASONS.MISSING_DATABASE_URL);
    expect(parseDatabaseTarget("not-a-url").reason).toBe(FAILURE_REASONS.INVALID_DATABASE_URL);
    expect(parseDatabaseTarget("mysql://u:p@localhost:3306/db").reason).toBe(
      FAILURE_REASONS.INVALID_DATABASE_URL
    );
  });

  test("never writes the database password to the log", () => {
    const directory = makeMigrations(seeded);
    const { exec } = succeedingExec();
    const logs = captureLogs();

    runApply({
      databaseUrl: "postgres://postgres:supersecret@localhost:5432/postgres",
      migrationsDirectory: directory,
      exec,
      log: logs.log,
      logError: logs.logError
    });

    const combined = [...logs.out, ...logs.err].join("\n");

    expect(combined).not.toContain("supersecret");
    expect(combined).toContain("//***@");
    expect(redactDatabaseUrl("postgres://postgres:supersecret@localhost:5432/postgres")).not.toContain(
      "supersecret"
    );
  });

  test("builds psql arguments that always fail closed", () => {
    const args = buildPsqlArgs({ databaseUrl: LOCAL_DSN, file: "db/migrations/a.sql" });

    expect(args).toEqual([
      "-v",
      "ON_ERROR_STOP=1",
      "--no-psqlrc",
      "-d",
      LOCAL_DSN,
      "-f",
      "db/migrations/a.sql"
    ]);
  });
});

describe("apply-migrations workflow: fail-closed contract", () => {
  test("delegates the whole validation to the isolated Supabase runner", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("node scripts/validate-migrations-disposable.js");
  });

  test("contains no unconditional suppression of a command failure", () => {
    expect(hasSuppressedFailure(readWorkflow())).toBe(false);
  });

  test("holds no token scope its executable steps cannot reach", () => {
    const workflow = readWorkflow();
    const scopes = topLevelPermissions(workflow);

    // The reporting steps need these two.
    expect(scopes).toEqual(expect.arrayContaining(["contents:read", "pull-requests:write"]));

    // `pages: write` and `id-token: write` were removed: the workflow triggers
    // only on pull_request, so its Pages publishing steps never run, while the
    // test job executes pull-request code.
    expect(scopes.filter((scope) => scope.startsWith("pages:"))).toEqual([]);
    expect(scopes.filter((scope) => scope.startsWith("id-token:"))).toEqual([]);
  });

  test("control: the permission scanner reads a synthetic block and stops at the next key", () => {
    const synthetic = [
      "permissions:",
      "  contents: read",
      "  pages: write",
      "  id-token: write",
      "jobs:",
      "  build:",
      "    permissions:",
      "      security-events: write"
    ].join("\n");

    expect(topLevelPermissions(synthetic)).toEqual([
      "contents:read",
      "pages:write",
      "id-token:write"
    ]);
  });

  test("runs no SQL through psql in the workflow at all", () => {
    // Every statement now executes inside the disposable container through the
    // runner, so the workflow itself must contain no psql invocation.
    expect(psqlInvocations(readWorkflow())).toEqual([]);
    expect(psqlFileInvocations(readWorkflow())).toEqual([]);
  });

  test("keeps every declared database target on loopback and never a staging or production host", () => {
    const workflow = readWorkflow();
    const dsnLines = workflow.split(/\r?\n/).filter((line) => /DATABASE_URL:\s*\S/.test(line));

    // The dependent test job still declares a loopback DSN for its own service;
    // the migration-validation step declares none at all, because the runner
    // addresses the database inside the container.
    for (const line of dsnLines) {
      expect(line).toContain("@localhost:5432");
    }

    const validationStep = workflow
      .split(/\r?\n/)
      .find((line) => line.includes("validate-migrations-disposable.js"));

    expect(validationStep).toBeDefined();
    expect(workflow).not.toMatch(/supabase\.co|pooler\.supabase/);
  });

  test("keeps only the test job's disposable service and the dependent job", () => {
    const workflow = readWorkflow();

    // The migration-validation job no longer declares a `services:` block.
    expect((workflow.match(/image: postgres:14/g) || [])).toHaveLength(1);
    expect(workflow).toContain("needs: apply-migrations");
    expect(workflow).toMatch(/timeout-minutes:/);
  });

  test("control: the scanners detect the configuration this change removed", () => {
    const legacy = [
      "      - name: Run grants audit",
      "        run: |",
      LEGACY_FAIL_OPEN_LINE,
      "          if [ -s /tmp/grants_audit.out ]; then exit 1; fi"
    ].join("\n");

    expect(hasSuppressedFailure(legacy)).toBe(true);
    expect(psqlFileInvocations(legacy)).toHaveLength(1);
    expect(psqlFileInvocations(legacy)[0]).not.toContain("ON_ERROR_STOP=1");
    expect(psqlInvocations(legacy)).toHaveLength(1);
  });

  test("control: documentation comments cannot satisfy or trip the scanners", () => {
    const commentOnly = [
      "# psql -f db/migrations/legacy.sql",
      '        # psql "$DATABASE_URL" -f db/scripts/grants_audit.sql > out || true'
    ].join("\n");

    expect(psqlInvocations(commentOnly)).toEqual([]);
    expect(psqlFileInvocations(commentOnly)).toEqual([]);
    expect(hasSuppressedFailure(commentOnly)).toBe(false);
  });

  test("control: YAML metadata that mentions psql is not treated as an invocation", () => {
    const metadataOnly = [
      "      - name: Install psql client",
      "        run: sudo apt-get install -y postgresql-client"
    ].join("\n");

    expect(psqlInvocations(metadataOnly)).toEqual([]);
    expect(psqlFileInvocations(metadataOnly)).toEqual([]);
  });
});

describe("canonical migration directory guard", () => {
  test("defaults to the canonical chain and never to the legacy directory", () => {
    expect(DEFAULT_MIGRATIONS_DIRECTORY).toBe("supabase/migrations");
    expect(LEGACY_MIGRATIONS_DIRECTORY).toBe("db/migrations");
    expect(DEFAULT_MIGRATIONS_DIRECTORY).not.toBe(LEGACY_MIGRATIONS_DIRECTORY);
  });

  test("accepts the canonical chain and rejects the legacy directory", () => {
    expect(classifyMigrationsDirectory("supabase/migrations").ok).toBe(true);
    expect(classifyMigrationsDirectory("./supabase/migrations/").ok).toBe(true);

    const legacy = classifyMigrationsDirectory("db/migrations");

    expect(legacy.ok).toBe(false);
    expect(legacy.reason).toBe(FAILURE_REASONS.LEGACY_MIGRATIONS_DIRECTORY);
    expect(legacy.legacy).toBe(true);
  });

  test("rejects the legacy directory however it is written", () => {
    const candidates = [
      "db/migrations",
      "db/migrations/",
      "./db/migrations",
      "db\\migrations",
      "/checkout/db/migrations",
      "C:\\checkout\\db\\migrations"
    ];

    for (const candidate of candidates) {
      const result = classifyMigrationsDirectory(candidate);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe(FAILURE_REASONS.LEGACY_MIGRATIONS_DIRECTORY);
    }
  });

  test("a merely wrong directory is not mistaken for the legacy directory", () => {
    expect(classifyMigrationsDirectory("supabase/migrations-typo").ok).toBe(true);
    expect(classifyMigrationsDirectory(undefined).reason).toBe(FAILURE_REASONS.NO_MIGRATIONS);
    expect(normalizeMigrationDirectory("db\\migrations\\")).toBe("db/migrations");
  });

  test("the legacy opt-in is explicit and cannot be reached by default", () => {
    expect(classifyMigrationsDirectory("db/migrations", { allowLegacy: true }).ok).toBe(true);
    expect(classifyMigrationsDirectory("db/migrations").ok).toBe(false);
  });

  test("runApply refuses the legacy directory and applies nothing", () => {
    const invocations = [];
    const exec = (args) => {
      invocations.push(args);

      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = runApply({ databaseUrl: LOCAL_DSN, migrationsDirectory: "db/migrations", exec });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.LEGACY_MIGRATIONS_DIRECTORY);
    expect(result.applied).toEqual([]);
    expect(invocations).toEqual([]);
  });

  test("runApply with no directory targets the canonical chain, not the legacy one", () => {
    const expected = discoverMigrationFiles("supabase/migrations");
    const applied = [];
    const exec = (args, context) => {
      applied.push(context.file);

      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = runApply({ databaseUrl: LOCAL_DSN, exec });

    expect(result.ok).toBe(true);
    expect(expected.length).toBeGreaterThan(0);
    expect(applied.length).toBe(expected.length);
    expect(applied).not.toContain("20260805_approved_sources_large_chunks.sql");
  });

  test("the legacy set applies only under the explicit in-code opt-in", () => {
    const applied = [];
    const exec = (args, context) => {
      applied.push(context.file);

      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = runApply({
      databaseUrl: LOCAL_DSN,
      migrationsDirectory: "db/migrations",
      allowLegacyDirectory: true,
      exec
    });

    expect(result.ok).toBe(true);
    expect(applied).toContain("20260805_approved_sources_large_chunks.sql");
  });
});

