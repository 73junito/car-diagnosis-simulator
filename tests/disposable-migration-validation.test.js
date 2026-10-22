"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  AUDIT_OUTCOMES,
  FAILURE_REASONS,
  buildPsqlArgs,
  classifyAuditOutcome,
  discoverMigrationFiles,
  parseDatabaseTarget,
  redactDatabaseUrl,
  runApply,
  runAudit,
  runValidation
} = require("../scripts/lib/disposable-migration-validation");

const { main } = require("../scripts/run-disposable-migration-validation");

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

    expect(calls[0].args[calls[0].args.indexOf("-f") + 1]).toBe("20260101_first.sql");
    expect(calls[1].args[calls[1].args.indexOf("-f") + 1]).toBe("20260102_second.sql");
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
    const { exec } = createExec(() => ({
      exitCode: 1,
      stdout: "",
      stderr: 'psql:db/scripts/grants_audit.sql:5: ERROR:  permission denied for schema public\n'
    }));
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
    const { exec, calls } = createExec(() => ({ exitCode: 0, stdout: `${rows}\n`, stderr: "" }));
    const logs = captureLogs();

    const result = runAudit({ databaseUrl: LOCAL_DSN, exec, log: logs.log, logError: logs.logError });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(FAILURE_REASONS.MISSING_GRANTS);
    expect(result.audit.outcome).toBe(AUDIT_OUTCOMES.MISSING_GRANTS);
    expect(result.audit.rows).toHaveLength(2);
    expect(logs.err.join("\n")).toContain("2 missing required Data API grant row(s)");
    expect(calls[0].args).toEqual(expect.arrayContaining(["-A", "-t", "-F", ","]));
    expect(calls[0].args).toContain("ON_ERROR_STOP=1");
  });

  test("passes only when the audit query succeeds and returns no rows", () => {
    for (const stdout of ["", "\n", "   \n"]) {
      const { exec } = createExec(() => ({ exitCode: 0, stdout, stderr: "" }));

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

describe("disposable migration validation: CLI exit status", () => {
  test("exits 0 when migrations apply and the audit is clean", () => {
    const directory = makeMigrations(seeded);
    const { exec, calls } = succeedingExec();
    const logs = captureLogs();

    const code = main(["--all"], {
      databaseUrl: LOCAL_DSN,
      migrationsDirectory: directory,
      exec,
      log: logs.log,
      logError: logs.logError
    });

    expect(code).toBe(0);
    expect(calls).toHaveLength(3);
    expect(calls[2].context.phase).toBe("audit");
  });

  test("exits 1 when a migration fails and 1 when the audit query fails", () => {
    const directory = makeMigrations(seeded);

    const migrationFailure = createExec(() => ({ exitCode: 3, stdout: "", stderr: "syntax error\n" }));
    const applyCode = main(["--apply"], {
      databaseUrl: LOCAL_DSN,
      migrationsDirectory: directory,
      exec: migrationFailure.exec,
      log: () => {},
      logError: () => {}
    });

    const auditFailure = createExec(() => ({ exitCode: 1, stdout: "", stderr: "audit exploded\n" }));
    const auditCode = main(["--audit"], {
      databaseUrl: LOCAL_DSN,
      exec: auditFailure.exec,
      log: () => {},
      logError: () => {}
    });

    expect(applyCode).toBe(1);
    expect(auditCode).toBe(1);
  });

  test("runs only migrations for --apply and only the audit for --audit", () => {
    const directory = makeMigrations(seeded);

    const apply = createExec(() => ({ exitCode: 0, stdout: "", stderr: "" }));
    main(["--apply"], {
      databaseUrl: LOCAL_DSN,
      migrationsDirectory: directory,
      exec: apply.exec,
      log: () => {},
      logError: () => {}
    });

    const audit = createExec(() => ({ exitCode: 0, stdout: "", stderr: "" }));
    main(["--audit"], {
      databaseUrl: LOCAL_DSN,
      exec: audit.exec,
      log: () => {},
      logError: () => {}
    });

    expect(apply.calls).toHaveLength(2);
    expect(apply.calls.every((call) => call.context.phase === "apply")).toBe(true);
    expect(audit.calls).toHaveLength(1);
    expect(audit.calls[0].context.phase).toBe("audit");
  });

  test("rejects an unknown mode without touching the database", () => {
    const { exec, calls } = succeedingExec();
    const logs = captureLogs();

    const code = main(["--nope"], {
      databaseUrl: LOCAL_DSN,
      exec,
      log: logs.log,
      logError: logs.logError
    });

    expect(code).toBe(1);
    expect(calls).toHaveLength(0);
    expect(logs.err.join("\n")).toContain("Unknown mode");
  });
});

describe("apply-migrations workflow: fail-closed contract", () => {
  test("delegates migration application and the grants audit to the fail-closed runner", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("node scripts/run-disposable-migration-validation.js --apply");
    expect(workflow).toContain("node scripts/run-disposable-migration-validation.js --audit");
  });

  test("contains no unconditional suppression of a command failure", () => {
    expect(hasSuppressedFailure(readWorkflow())).toBe(false);
  });

  test("runs no SQL file through psql outside the fail-closed runner", () => {
    expect(psqlFileInvocations(readWorkflow())).toEqual([]);
  });

  test("every remaining psql invocation fails closed on SQL errors", () => {
    const invocations = psqlInvocations(readWorkflow());

    expect(invocations.length).toBeGreaterThan(0);

    for (const line of invocations) {
      expect(line).toContain("ON_ERROR_STOP=1");
      expect(line).toContain("--no-psqlrc");
    }
  });

  test("keeps every declared target on the disposable loopback service", () => {
    const workflow = readWorkflow();
    const dsnLines = workflow.split(/\r?\n/).filter((line) => /DATABASE_URL:\s*postgres/.test(line));

    expect(dsnLines.length).toBeGreaterThan(0);

    for (const line of dsnLines) {
      expect(line).toContain("@localhost:5432");
    }

    expect(workflow).not.toMatch(/supabase\.co|pooler\.supabase/);
  });

  test("preserves the disposable service image contract and the dependent job", () => {
    const workflow = readWorkflow();

    expect((workflow.match(/image: postgres:14/g) || [])).toHaveLength(2);
    expect(workflow).toContain("needs: apply-migrations");
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
