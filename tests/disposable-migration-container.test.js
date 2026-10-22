"use strict";

const {
  APPROVED_SUPABASE_IMAGE,
  APPROVED_SUPABASE_IMAGE_DIGEST,
  BOOKKEEPING_SCHEMA,
  BOOTSTRAP_SQL,
  REQUIRED_PLATFORM_ROLES,
  REQUIRED_SCHEMAS,
  assertDisposableContainerName,
  buildInitialisationProbeArgs,
  classifyInitialisation,
  initialisationProbeSql,
  isolationViolations,
  parseIsolation
} = require("../scripts/lib/disposable-migration-container");

const {
  CONTAINER_MIGRATIONS_DIR,
  CONTAINER_AUDIT_SQL,
  createContainerPsqlExecutor,
  createPathMapper,
  main,
  validate
} = require("../scripts/validate-migrations-disposable");

const CLEAN_INSPECT = {
  HostConfig: { NetworkMode: "none", Binds: null, PortBindings: {} },
  Mounts: [],
  Image: APPROVED_SUPABASE_IMAGE_DIGEST
};

const READY_PROBE = [
  ...REQUIRED_SCHEMAS.map((name) => `schema:${name}`),
  ...REQUIRED_PLATFORM_ROLES.map((name) => `role:${name}`),
  "probe:1",
  "bookkeeping:0",
  "start:1792634028"
].join("\n");

function createFakeDocker(handler) {
  const calls = [];
  const docker = (args) => {
    calls.push(args);

    return handler(args, calls);
  };

  docker.calls = calls;

  return docker;
}

/** Happy-path docker: isolated, ready, apply and audit both succeed. */
function happyDocker({ roles = ["anon", "authenticated"], probe = READY_PROBE } = {}) {
  return createFakeDocker((args) => {
    const [command] = args;

    if (command === "run") {
      return { exitCode: 0, stdout: "abcdef123456\n", stderr: "" };
    }

    if (command === "inspect") {
      return { exitCode: 0, stdout: JSON.stringify([CLEAN_INSPECT]), stderr: "" };
    }

    if (command === "cp" || command === "rm") {
      return { exitCode: 0, stdout: "", stderr: "" };
    }

    if (command === "exec") {
      const inline = args[args.indexOf("-c") + 1] || "";

      // The probe SQL also mentions pg_roles, so discriminate on the probe's
      // own marker first, otherwise the gate would never report ready.
      if (inline.includes("union all")) {
        return { exitCode: 0, stdout: probe, stderr: "" };
      }

      if (inline.includes("pg_roles")) {
        return { exitCode: 0, stdout: roles.length ? `${roles.join("\n")}\n` : "", stderr: "" };
      }

      return { exitCode: 0, stdout: "", stderr: "" };
    }

    return { exitCode: 0, stdout: "", stderr: "" };
  });
}

const silent = { log: () => {}, logError: () => {} };

function runValidate(docker, overrides = {}) {
  return validate({
    docker,
    container: "tm-migval-test",
    image: APPROVED_SUPABASE_IMAGE,
    migrationsDirectory: "supabase/migrations",
    auditSqlPath: "db/scripts/grants_audit.sql",
    log: silent.log,
    logError: silent.logError,
    sleep: async () => {},
    now: () => 0,
    initTimeoutMs: 600000,
    initPollMs: 5000,
    keepContainer: false,
    ...overrides
  });
}

describe("disposable migration container: name safety", () => {
  test("accepts the disposable prefix and rejects anything protected", () => {
    expect(assertDisposableContainerName("tm-migval-ci")).toBeNull();
    expect(assertDisposableContainerName("tm-migval-local")).toBeNull();

    // This host runs a live local Supabase stack on the same image.
    expect(assertDisposableContainerName("supabase_db_Car_Diagnosis_Simulator")).toContain("protected");
    expect(assertDisposableContainerName("postgres")).toContain("protected");
    expect(assertDisposableContainerName("torquemind-pg17-check2")).toContain("must start with");
    expect(assertDisposableContainerName("")).toContain("required");
    expect(assertDisposableContainerName(undefined)).toContain("required");
  });
});

describe("disposable migration container: isolation assertions", () => {
  test("accepts a container with no network, no mounts, no ports and the approved digest", () => {
    expect(isolationViolations({ name: "tm-migval-ci", inspect: CLEAN_INSPECT })).toEqual([]);
  });

  test("rejects each isolation violation individually", () => {
    const cases = [
      [{ ...CLEAN_INSPECT, HostConfig: { ...CLEAN_INSPECT.HostConfig, NetworkMode: "bridge" } }, "NetworkMode"],
      [{ ...CLEAN_INSPECT, HostConfig: { ...CLEAN_INSPECT.HostConfig, Binds: ["/host:/container"] } }, "bind mounts"],
      [{ ...CLEAN_INSPECT, Mounts: [{ Type: "volume" }] }, "Host mounts"],
      [
        { ...CLEAN_INSPECT, HostConfig: { ...CLEAN_INSPECT.HostConfig, PortBindings: { "5432/tcp": [{}] } } },
        "Published database ports"
      ],
      [{ ...CLEAN_INSPECT, Image: "sha256:deadbeef" }, "Image digest"]
    ];

    for (const [inspect, expected] of cases) {
      const violations = isolationViolations({ name: "tm-migval-ci", inspect });

      expect(violations.join(" ")).toContain(expected);
    }
  });

  test("parses only the isolation-relevant fields", () => {
    expect(parseIsolation(CLEAN_INSPECT)).toEqual({
      networkMode: "none",
      binds: [],
      portBindings: {},
      mounts: [],
      imageId: APPROVED_SUPABASE_IMAGE_DIGEST
    });
    expect(parseIsolation(undefined).networkMode).toBeNull();
  });
});

describe("disposable migration container: initialisation gate", () => {
  test("is ready only when every schema, role and the init probe are present", () => {
    const result = classifyInitialisation({ exitCode: 0, stdout: READY_PROBE });

    expect(result.ready).toBe(true);
    expect(result.schemas).toHaveLength(REQUIRED_SCHEMAS.length);
    expect(result.roles).toEqual(REQUIRED_PLATFORM_ROLES);
    expect(result.message).toContain("initialised");
  });

  test("is not ready when a schema, a role or the probe is missing", () => {
    const noSchema = classifyInitialisation({
      exitCode: 0,
      stdout: READY_PROBE.replace("schema:auth\n", "")
    });

    expect(noSchema.ready).toBe(false);
    expect(noSchema.missingSchemas).toEqual(["auth"]);
    expect(noSchema.message).toContain("missing schema");

    const noRole = classifyInitialisation({
      exitCode: 0,
      stdout: READY_PROBE.replace("role:authenticated\n", "")
    });

    expect(noRole.ready).toBe(false);
    expect(noRole.missingRoles).toEqual(["authenticated"]);

    const noProbe = classifyInitialisation({
      exitCode: 0,
      stdout: READY_PROBE.replace("probe:1", "probe:0")
    });

    expect(noProbe.ready).toBe(false);
    expect(noProbe.message).toContain("initialisation incomplete");
  });

  test("refuses a reused instance whose bookkeeping relation already exists", () => {
    const reused = classifyInitialisation({
      exitCode: 0,
      stdout: READY_PROBE.replace("bookkeeping:0", "bookkeeping:1")
    });

    expect(reused.ready).toBe(false);
    expect(reused.bookkeepingPresent).toBe(true);
    expect(reused.message).toContain("not fresh");
  });

  test("reports a failed probe rather than assuming readiness", () => {
    const failed = classifyInitialisation({ exitCode: 2, stdout: "" });

    expect(failed.ready).toBe(false);
    expect(failed.reason).toBe("probe-failed");
    expect(failed.missingSchemas).toEqual([...REQUIRED_SCHEMAS]);
  });

  test("the probe and bootstrap SQL are read-only and never write history", () => {
    const probe = initialisationProbeSql();

    for (const schema of REQUIRED_SCHEMAS) {
      expect(probe).toContain(`'${schema}'`);
    }

    expect(probe.toLowerCase()).not.toContain("insert");
    expect(probe.toLowerCase()).not.toContain("delete");
    expect(probe.toLowerCase()).not.toContain("drop");
    expect(BOOTSTRAP_SQL).toContain(BOOKKEEPING_SCHEMA);
    expect(BOOTSTRAP_SQL).toContain("create table if not exists");
    expect(BOOTSTRAP_SQL.toLowerCase()).not.toContain("insert");
  });

  test("the probe connects over TCP and reports the postmaster start time", () => {
    const args = buildInitialisationProbeArgs();

    // TCP is the transport the migrations use, so a successful probe proves the
    // server is genuinely reachable rather than merely socket-present.
    expect(args[args.indexOf("-h") + 1]).toBe("127.0.0.1");
    expect(args).toContain("ON_ERROR_STOP=1");
    expect(args).not.toContain("-f");
    expect(args[args.indexOf("-c") + 1]).toContain("pg_postmaster_start_time");
  });
});

describe("disposable migration container: path mapping and psql execution", () => {
  test("maps migrations and the audit SQL into the container copy locations", () => {
    const mapPath = createPathMapper({ auditSqlPath: "db/scripts/grants_audit.sql" });

    expect(mapPath("supabase/migrations/20260101000000_a.sql")).toBe(
      `${CONTAINER_MIGRATIONS_DIR}/20260101000000_a.sql`
    );
    expect(mapPath("db/scripts/grants_audit.sql")).toBe(CONTAINER_AUDIT_SQL);
  });

  test("rewrites only the -f value and preserves the fail-closed flags", () => {
    const docker = createFakeDocker(() => ({ exitCode: 0, stdout: "", stderr: "" }));
    const exec = createContainerPsqlExecutor({
      docker,
      container: "tm-migval-test",
      mapPath: createPathMapper({ auditSqlPath: "db/scripts/grants_audit.sql" })
    });

    exec([
      "-v",
      "ON_ERROR_STOP=1",
      "--no-psqlrc",
      "-d",
      "postgres://x@localhost:5432/postgres",
      "-f",
      "supabase/migrations/a.sql"
    ]);

    expect(docker.calls[0]).toEqual([
      "exec",
      "-i",
      "tm-migval-test",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "--no-psqlrc",
      "-d",
      "postgres://x@localhost:5432/postgres",
      "-f",
      `${CONTAINER_MIGRATIONS_DIR}/a.sql`
    ]);
  });
});

describe("disposable migration container: end-to-end orchestration", () => {
  test("runs every step in order and tears the container down on success", async () => {
    const docker = happyDocker();

    const result = await runValidate(docker);

    expect(result.ok).toBe(true);
    expect(result.steps.map((step) => step.name)).toEqual([
      "start",
      "isolation",
      "initialisation",
      "bootstrap",
      "transfer",
      "apply",
      "audit",
      "teardown"
    ]);
    expect(result.steps.every((step) => step.ok)).toBe(true);
    expect(result.evidence.isolation.networkMode).toBe("none");
    expect(result.evidence.roles).toEqual(["anon", "authenticated"]);
    expect(result.evidence.audit).toEqual({ outcome: "clean", rows: 0 });
    expect(docker.calls.some((args) => args[0] === "rm")).toBe(true);
  });

  test("aborts before running anything when the container is not isolated", async () => {
    const docker = createFakeDocker((args) => {
      if (args[0] === "run") {
        return { exitCode: 0, stdout: "abc\n", stderr: "" };
      }

      if (args[0] === "inspect") {
        return {
          exitCode: 0,
          stdout: JSON.stringify([
            { ...CLEAN_INSPECT, HostConfig: { ...CLEAN_INSPECT.HostConfig, NetworkMode: "bridge" } }
          ]),
          stderr: ""
        };
      }

      return { exitCode: 0, stdout: "", stderr: "" };
    });

    const result = await runValidate(docker);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("isolation-violated");
    // nothing was executed inside the container
    expect(docker.calls.some((args) => args[0] === "exec")).toBe(false);
    expect(docker.calls.some((args) => args[0] === "cp")).toBe(false);
    // and the container is still removed
    expect(docker.calls.some((args) => args[0] === "rm")).toBe(true);
  });

  test("aborts when initialisation never completes", async () => {
    const docker = happyDocker({ probe: READY_PROBE.replace("schema:vault\n", "") });

    const result = await runValidate(docker, { initTimeoutMs: 0 });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("initialisation-timeout");
    expect(docker.calls.some((args) => args[0] === "cp")).toBe(false);
    expect(docker.calls.some((args) => args[0] === "rm")).toBe(true);
  });

  test("refuses an instance whose server is still being cycled", async () => {
    // The entrypoint restarts the server, so the platform objects can be present
    // while the postmaster keeps changing. That must not be treated as ready.
    let start = 1792633943;
    const docker = createFakeDocker((args) => {
      if (args[0] === "run") {
        return { exitCode: 0, stdout: "abc\n", stderr: "" };
      }

      if (args[0] === "inspect") {
        return { exitCode: 0, stdout: JSON.stringify([CLEAN_INSPECT]), stderr: "" };
      }

      if (args[0] === "exec") {
        const inline = args[args.indexOf("-c") + 1] || "";

        if (inline.includes("union all")) {
          start += 1;

          return { exitCode: 0, stdout: READY_PROBE.replace(/start:\d+/, `start:${start}`), stderr: "" };
        }

        return { exitCode: 0, stdout: "", stderr: "" };
      }

      return { exitCode: 0, stdout: "", stderr: "" };
    });

    const result = await runValidate(docker, { initTimeoutMs: 0 });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("initialisation-timeout");
    expect(result.evidence.initialisation.stable).toBe(false);
    expect(docker.calls.some((args) => args[0] === "cp")).toBe(false);
  });

  test("aborts on a migration failure and never reaches the audit", async () => {
    const docker = createFakeDocker((args) => {
      if (args[0] === "run") {
        return { exitCode: 0, stdout: "abc\n", stderr: "" };
      }

      if (args[0] === "inspect") {
        return { exitCode: 0, stdout: JSON.stringify([CLEAN_INSPECT]), stderr: "" };
      }

      if (args[0] === "exec") {
        const inline = args[args.indexOf("-c") + 1] || "";

        if (inline.includes("union all")) {
          return { exitCode: 0, stdout: READY_PROBE, stderr: "" };
        }

        // a migration run that fails
        if (args.includes("-f")) {
          return { exitCode: 3, stdout: "", stderr: "psql: syntax error\n" };
        }

        return { exitCode: 0, stdout: "", stderr: "" };
      }

      return { exitCode: 0, stdout: "", stderr: "" };
    });

    const result = await runValidate(docker);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("migration-failed");
    expect(result.steps.some((step) => step.name === "audit")).toBe(false);
    expect(docker.calls.some((args) => args[0] === "rm")).toBe(true);
  });

  test("fails closed when the audited roles are missing in the container", async () => {
    const docker = happyDocker({ roles: [] });

    const result = await runValidate(docker);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("roles-missing");
    expect(result.evidence.roles).toEqual([]);
  });

  test("keeps the container when asked, for diagnostics", async () => {
    const docker = happyDocker();

    const result = await runValidate(docker, { keepContainer: true });

    expect(result.ok).toBe(true);
    expect(docker.calls.some((args) => args[0] === "rm")).toBe(false);
  });

  test("main refuses a protected container name without invoking docker", async () => {
    const docker = createFakeDocker(() => ({ exitCode: 0, stdout: "", stderr: "" }));

    const code = await main(["--container", "supabase_db_Car_Diagnosis_Simulator"], {
      docker,
      log: silent.log,
      logError: silent.logError
    });

    expect(code).toBe(1);
    expect(docker.calls).toHaveLength(0);
  });
});
