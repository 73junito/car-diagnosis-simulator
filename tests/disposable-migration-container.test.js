"use strict";

const fs = require("fs");
const path = require("path");

const {
  APPROVED_SUPABASE_IMAGE,
  APPROVED_SUPABASE_IMAGE_DIGEST,
  BOOKKEEPING_SCHEMA,
  BOOTSTRAP_SQL,
  REQUIRED_PLATFORM_ROLES,
  REQUIRED_SCHEMAS,
  assertDisposableContainerName,
  buildInitialisationProbeArgs,
  buildRoleEquivalenceArgs,
  classifyRoleEquivalence,
  PLATFORM_MIGRATION_ROLE,
  roleEquivalenceProbeSql,
  classifyInitialisation,
  initialisationProbeSql,
  isolationViolations,
  imageProvenanceViolations,
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

/** Container inspect: network none, no mounts, no published ports. */
const CLEAN_INSPECT = {
  HostConfig: { NetworkMode: "none", Binds: null, PortBindings: {} },
  Mounts: [],
  Image: APPROVED_SUPABASE_IMAGE_DIGEST
};

/**
 * What `docker image inspect` returns for the approved image. The container
 * inspection carries no digest metadata at all, so this is the only place
 * image provenance can come from.
 */
const APPROVED_IMAGE_INSPECT = {
  Id: APPROVED_SUPABASE_IMAGE_DIGEST,
  RepoDigests: [
    `ghcr.io/supabase/postgres@${APPROVED_SUPABASE_IMAGE_DIGEST}`,
    `public.ecr.aws/supabase/postgres@${APPROVED_SUPABASE_IMAGE_DIGEST}`
  ]
};

/** The platform configuration id a manifest-list pull resolves to on a runner. */
const PLATFORM_IMAGE_ID = "sha256:66089200353d90686fe9b252a47d17d078364bf47c50190852c33dc850a0191f";

const READY_PROBE = [
  ...REQUIRED_SCHEMAS.map((name) => `schema:${name}`),
  ...REQUIRED_PLATFORM_ROLES.map((name) => `role:${name}`),
  "probe:1",
  "bookkeeping:0",
  "start:1792634028"
].join("\n");

function createFakeDocker(handler, { imageInspect = APPROVED_IMAGE_INSPECT } = {}) {
  const calls = [];
  const docker = (args) => {
    calls.push(args);

    // `docker image inspect <id>` returns the image's own metadata, which is
    // where the digest provenance lives; a container inspection never carries
    // it. `imageInspect: null` models a store that cannot report it.
    if (args[0] === "image") {
      if (!imageInspect) {
        return { exitCode: 1, stdout: "", stderr: "Error: No such image" };
      }

      return { exitCode: 0, stdout: JSON.stringify([imageInspect]), stderr: "" };
    }

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
      return { exitCode: 0, stdout: `${CONTAINER_ID}\n`, stderr: "" };
    }

    if (command === "inspect") {
      return inspectResponse(args);
    }

    if (command === "image") {
      return { exitCode: 0, stdout: JSON.stringify([CLEAN_IMAGE_INSPECT]), stderr: "" };
    }

    if (command === "cp" || command === "rm") {
      return { exitCode: 0, stdout: "", stderr: "" };
    }

    if (command === "exec") {
      const inline = args[args.indexOf("-c") + 1] || "";

      // Three different probes reach this fake; discriminate on their own SQL
      // markers. The policy probe must be checked first because the init probe
      // also uses `union all`.
      if (inline.includes("role_table_grants")) {
        return { exitCode: 0, stdout: policyProbeFromManifest(), stderr: "" };
      }

      if (inline.includes("pg_postmaster_start_time")) {
        return { exitCode: 0, stdout: probe, stderr: "" };
      }

      // The role-equivalence probe also references pg_roles, so it must be
      // matched before the role-precondition probe.
      if (inline.includes("platform_member")) {
        return { exitCode: 0, stdout: ROLE_EQUIVALENCE_OK, stderr: "" };
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

/** Platform-equivalent execution context: non-superuser, not a platform member. */
const ROLE_EQUIVALENCE_OK = [
  "role:postgres",
  "session:postgres",
  "superuser:false",
  "platform_member:0",
  "db_owner:postgres",
  "create_on_public:true",
  "expected_role:postgres"
].join("\n");

/** Container ID returned by the fake `docker run` and echoed by `inspect --format`. */
const CONTAINER_ID = "abcdef123456";

/**
 * `docker inspect` is called twice with different shapes: once without
 * `--format` for the isolation assertions, and once with `--format {{.Id}}` to
 * prove ownership before teardown.
 */
function inspectResponse(args, inspect = CLEAN_INSPECT, id = CONTAINER_ID) {
  if (args.includes("--format")) {
    return { exitCode: 0, stdout: `${id}\n`, stderr: "" };
  }

  return { exitCode: 0, stdout: JSON.stringify([inspect]), stderr: "" };
}

/**
 * Build the policy-probe payload from the committed manifest, so the happy path
 * is a real comparison rather than a stubbed string.
 */
function policyProbeFromManifest() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "docs", "database", "table-access-policy.json"), "utf8")
  );
  const lines = ["role:anon", "role:authenticated"];

  for (const [name, entry] of Object.entries(manifest.tables)) {
    lines.push(`table:${name}`);

    for (const role of ["anon", "authenticated"]) {
      for (const privilege of entry[role]) {
        lines.push(`grant:${role}|${name}|${privilege}`);
      }
    }
  }

  return lines.join("\n");
}

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
  test("accepts a container with no network, no mounts, no ports and the approved image", () => {
    expect(
      isolationViolations({
        name: "tm-migval-ci",
        inspect: CLEAN_INSPECT,
        imageInspect: APPROVED_IMAGE_INSPECT
      })
    ).toEqual([]);
  });

  test("rejects each isolation violation individually", () => {
    const cases = [
      [{ ...CLEAN_INSPECT, HostConfig: { ...CLEAN_INSPECT.HostConfig, NetworkMode: "bridge" } }, "NetworkMode"],
      [{ ...CLEAN_INSPECT, HostConfig: { ...CLEAN_INSPECT.HostConfig, Binds: ["/host:/container"] } }, "bind mounts"],
      [{ ...CLEAN_INSPECT, Mounts: [{ Type: "volume" }] }, "Host mounts"],
      [
        { ...CLEAN_INSPECT, HostConfig: { ...CLEAN_INSPECT.HostConfig, PortBindings: { "5432/tcp": [{}] } } },
        "Published database ports"
      ]
    ];

    for (const [inspect, expected] of cases) {
      const violations = isolationViolations({
        name: "tm-migval-ci",
        inspect,
        imageInspect: APPROVED_IMAGE_INSPECT
      });

      expect(violations.join(" ")).toContain(expected);
    }
  });

  test("parses only the isolation-relevant fields, and never provenance", () => {
    expect(parseIsolation(CLEAN_INSPECT)).toEqual({
      networkMode: "none",
      binds: [],
      portBindings: {},
      mounts: [],
      imageId: APPROVED_SUPABASE_IMAGE_DIGEST
    });
    // A container inspect carries no RepoDigests key at all, so provenance must
    // never be read from here. Reading it here is exactly the defect that made the
    // hosted run fail closed, and this asserts it cannot come back.
    expect(parseIsolation(CLEAN_INSPECT).repoDigests).toBeUndefined();
    expect(parseIsolation({ ...CLEAN_INSPECT, RepoDigests: ["ghcr.io/x@sha256:00"] }).repoDigests).toBeUndefined();
    expect(parseIsolation(undefined).networkMode).toBeNull();
  });
});

describe("disposable migration container: image provenance", () => {
  test("accepts a manifest-list pull whose platform configuration id differs from the pinned digest", () => {
    // On a hosted runner the pinned digest is a manifest-list digest, so the
    // running image id is the platform configuration id. The provenance comes
    // from the image inspection, and the two are correlated by image id.
    const manifestListPull = { ...CLEAN_INSPECT, Image: PLATFORM_IMAGE_ID };
    const manifestListImage = {
      Id: PLATFORM_IMAGE_ID,
      RepoDigests: [`ghcr.io/supabase/postgres@${APPROVED_SUPABASE_IMAGE_DIGEST}`]
    };

    expect(
      isolationViolations({
        name: "tm-migval-ci",
        inspect: manifestListPull,
        imageInspect: manifestListImage
      })
    ).toEqual([]);
  });

  test("accepts the running image when it is the image the approved digest resolves to", () => {
    // The strongest proof does not depend on the image store recording any
    // digest metadata: the running image is the very image the approved digest
    // resolves to on this platform.
    const manifestListPull = { ...CLEAN_INSPECT, Image: PLATFORM_IMAGE_ID };

    expect(
      isolationViolations({
        name: "tm-migval-ci",
        inspect: manifestListPull,
        imageInspect: { Id: PLATFORM_IMAGE_ID, RepoDigests: [] },
        approvedImageId: PLATFORM_IMAGE_ID
      })
    ).toEqual([]);
  });

  test("rejects a running image that is not the image the approved digest resolves to", () => {
    const manifestListPull = { ...CLEAN_INSPECT, Image: PLATFORM_IMAGE_ID };

    const violations = isolationViolations({
      name: "tm-migval-ci",
      inspect: manifestListPull,
      imageInspect: { Id: PLATFORM_IMAGE_ID, RepoDigests: [] },
      approvedImageId: "sha256:9999999999999999999999999999999999999999999999999999999999999999"
    });

    expect(violations.join(" ")).toContain("must originate from the approved digest");
  });

  test("does not accept digest metadata carried by the container inspection", () => {
    // `docker inspect <container>` has no RepoDigests field at all. A container
    // inspection that claims one must not be able to grant approval.
    const containerClaimingDigests = {
      ...CLEAN_INSPECT,
      Image: PLATFORM_IMAGE_ID,
      RepoDigests: [`ghcr.io/supabase/postgres@${APPROVED_SUPABASE_IMAGE_DIGEST}`]
    };

    const violations = isolationViolations({
      name: "tm-migval-ci",
      inspect: containerClaimingDigests,
      imageInspect: { Id: PLATFORM_IMAGE_ID, RepoDigests: [] }
    });

    expect(violations.join(" ")).toContain("must originate from the approved digest");
  });

  test("rejects an unapproved image even when digest metadata is present", () => {
    const unapproved = {
      Id: "sha256:deadbeef",
      RepoDigests: ["ghcr.io/supabase/postgres@sha256:1111111111111111111111111111111111111111111111111111111111111111"]
    };

    const violations = isolationViolations({
      name: "tm-migval-ci",
      inspect: { ...CLEAN_INSPECT, Image: "sha256:deadbeef" },
      imageInspect: unapproved
    });

    expect(violations.join(" ")).toContain("must originate from the approved digest");
  });

  test("rejects a tag-only pull with missing digest metadata", () => {
    const violations = isolationViolations({
      name: "tm-migval-ci",
      inspect: { ...CLEAN_INSPECT, Image: "sha256:deadbeef" },
      imageInspect: { Id: "sha256:deadbeef", RepoDigests: [] }
    });

    expect(violations.join(" ")).toContain("must originate from the approved digest");
  });

  test("rejects malformed digest metadata", () => {
    const violations = isolationViolations({
      name: "tm-migval-ci",
      inspect: { ...CLEAN_INSPECT, Image: "sha256:deadbeef" },
      imageInspect: {
        Id: "sha256:deadbeef",
        RepoDigests: ["not-a-digest", "ghcr.io/supabase/postgres:17.6.1.167"]
      }
    });

    expect(violations.join(" ")).toContain("must originate from the approved digest");
  });

  test("fails closed when the image inspection is unavailable", () => {
    const violations = isolationViolations({
      name: "tm-migval-ci",
      inspect: CLEAN_INSPECT,
      imageInspect: null
    });

    expect(violations.join(" ")).toContain("could not be established");
  });

  test("rejects an inspected image that is not the image running in the container", () => {
    const violations = isolationViolations({
      name: "tm-migval-ci",
      inspect: { ...CLEAN_INSPECT, Image: "sha256:deadbeef" },
      imageInspect: { ...APPROVED_IMAGE_INSPECT, Id: "sha256:1111111111111111111111111111111111111111111111111111111111111111" }
    });

    expect(violations.join(" ")).toContain("is not the image running in the container");
  });

  test("reports the provenance violations of a single inspection", () => {
    expect(
      imageProvenanceViolations({
        imageInspect: APPROVED_IMAGE_INSPECT,
        containerImageId: APPROVED_SUPABASE_IMAGE_DIGEST
      })
    ).toEqual([]);

    expect(
      imageProvenanceViolations({
        imageInspect: { Id: APPROVED_SUPABASE_IMAGE_DIGEST, RepoDigests: [] },
        containerImageId: PLATFORM_IMAGE_ID
      }).join(" ")
    ).toContain("must originate from the approved digest");
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
      "migrations-directory",
      "start",
      "isolation",
      "initialisation",
      "role-equivalence",
      "bootstrap",
      "transfer",
      "apply",
      "audit",
      "teardown"
    ]);
    expect(result.steps.every((step) => step.ok)).toBe(true);
    expect(result.evidence.isolation.networkMode).toBe("none");
    expect(result.evidence.roles).toEqual(["anon", "authenticated"]);
    expect(result.evidence.policy.tablesInDatabase).toBeGreaterThan(50);
    expect(result.evidence.policy.violations).toBe(0);
    expect(docker.calls.some((args) => args[0] === "rm")).toBe(true);
  });

  test("aborts before running anything when the container is not isolated", async () => {
    const docker = createFakeDocker((args) => {
      if (args[0] === "run") {
        return { exitCode: 0, stdout: `${CONTAINER_ID}\n`, stderr: "" };
      }

      if (args[0] === "inspect") {
        return inspectResponse(args, {
          ...CLEAN_INSPECT,
          HostConfig: { ...CLEAN_INSPECT.HostConfig, NetworkMode: "bridge" }
        });
      }

      if (args[0] === "image") {
        return { exitCode: 0, stdout: JSON.stringify([CLEAN_IMAGE_INSPECT]), stderr: "" };
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

  test("aborts before running anything when the image provenance cannot be established", async () => {
    const docker = createFakeDocker(
      (args) => {
        if (args[0] === "run") {
          return { exitCode: 0, stdout: `${CONTAINER_ID}\n`, stderr: "" };
        }

        if (args[0] === "inspect") {
          return inspectResponse(args);
        }

        return { exitCode: 0, stdout: "", stderr: "" };
      },
      { imageInspect: null }
    );

    const result = await runValidate(docker);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("isolation-violated");
    expect(result.steps.find((step) => step.name === "isolation").detail).toContain(
      "could not be established"
    );
    // nothing was executed inside the container
    expect(docker.calls.some((args) => args[0] === "exec")).toBe(false);
    expect(docker.calls.some((args) => args[0] === "cp")).toBe(false);
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
        return { exitCode: 0, stdout: `${CONTAINER_ID}\n`, stderr: "" };
      }

      if (args[0] === "inspect") {
        return inspectResponse(args);
      }

      if (args[0] === "image") {
        return { exitCode: 0, stdout: JSON.stringify([CLEAN_IMAGE_INSPECT]), stderr: "" };
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
        return { exitCode: 0, stdout: `${CONTAINER_ID}\n`, stderr: "" };
      }

      if (args[0] === "inspect") {
        return inspectResponse(args);
      }

      if (args[0] === "image") {
        return { exitCode: 0, stdout: JSON.stringify([CLEAN_IMAGE_INSPECT]), stderr: "" };
      }

      if (args[0] === "exec") {
        const inline = args[args.indexOf("-c") + 1] || "";

        if (inline.includes("platform_member")) {
          return { exitCode: 0, stdout: ROLE_EQUIVALENCE_OK, stderr: "" };
        }

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

  test("refuses teardown when the container ID no longer matches", async () => {
    // A name can be reused by another run; the ID proves which object this run
    // created, so a mismatch must stop the removal.
    const docker = createFakeDocker((args) => {
      if (args[0] === "run") {
        return { exitCode: 0, stdout: `${CONTAINER_ID}\n`, stderr: "" };
      }

      if (args[0] === "inspect") {
        return inspectResponse(args, CLEAN_INSPECT, "replaced99999");
      }

      return { exitCode: 0, stdout: "", stderr: "" };
    });

    const result = await runValidate(docker, { initTimeoutMs: 0 });
    const teardown = result.steps.find((step) => step.name === "teardown");

    expect(teardown.ok).toBe(false);
    expect(teardown.detail).toContain("ownership not established");
    expect(docker.calls.some((args) => args[0] === "rm")).toBe(false);
  });

  test("refuses teardown when ownership cannot be determined", async () => {
    const docker = createFakeDocker((args) => {
      if (args[0] === "run") {
        return { exitCode: 0, stdout: `${CONTAINER_ID}\n`, stderr: "" };
      }

      if (args[0] === "inspect" && args.includes("--format")) {
        return { exitCode: 1, stdout: "", stderr: "Error: No such container" };
      }

      if (args[0] === "inspect") {
        return inspectResponse(args);
      }

      return { exitCode: 0, stdout: "", stderr: "" };
    });

    const result = await runValidate(docker, { initTimeoutMs: 0 });
    const teardown = result.steps.find((step) => step.name === "teardown");

    expect(teardown.ok).toBe(false);
    expect(docker.calls.some((args) => args[0] === "rm")).toBe(false);
  });

  test("removes by container ID, never by name", async () => {
    const docker = happyDocker();

    await runValidate(docker);

    const removal = docker.calls.find((args) => args[0] === "rm");

    expect(removal).toBeDefined();
    expect(removal[removal.length - 1]).toBe(CONTAINER_ID);
    expect(removal).not.toContain("tm-migval-test");
  });
});

describe("disposable migration container: platform-equivalent role", () => {
  test("accepts the platform migration role: non-superuser, no platform membership", () => {
    const result = classifyRoleEquivalence({ exitCode: 0, stdout: ROLE_EQUIVALENCE_OK });

    expect(result.ok).toBe(true);
    expect(result.role).toBe(PLATFORM_MIGRATION_ROLE);
    expect(result.superuser).toBe(false);
    expect(result.platformMember).toBe(false);
    expect(result.message).toContain("Platform-equivalent");
  });

  test("rejects a rehearsal running as a superuser", () => {
    const stdout = ROLE_EQUIVALENCE_OK.replace("role:postgres", "role:supabase_admin").replace("superuser:false", "superuser:true");
    const result = classifyRoleEquivalence({ exitCode: 0, stdout });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not-platform-equivalent");
    expect(result.message).toContain("is a superuser");
  });

  test("rejects a role that is a member of a platform-managed role", () => {
    const result = classifyRoleEquivalence({
      exitCode: 0,
      stdout: ROLE_EQUIVALENCE_OK.replace("platform_member:0", "platform_member:1")
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("platform-managed role");
  });

  test("rejects a role that cannot create in public, and a mismatched expected role", () => {
    expect(
      classifyRoleEquivalence({
        exitCode: 0,
        stdout: ROLE_EQUIVALENCE_OK.replace("create_on_public:true", "create_on_public:false")
      }).ok
    ).toBe(false);
    expect(classifyRoleEquivalence({ exitCode: 0, stdout: ROLE_EQUIVALENCE_OK, expectedRole: "supabase_admin" }).ok).toBe(false);
  });

  test("fails closed when the role probe itself errors", () => {
    const result = classifyRoleEquivalence({ exitCode: 2, stdout: "" });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("probe-failed");
  });

  test("the probe is read-only, runs over TCP, and asks for the platform facts", () => {
    const sql = roleEquivalenceProbeSql();
    const args = buildRoleEquivalenceArgs({ user: PLATFORM_MIGRATION_ROLE, database: "postgres" });

    expect(sql).toContain("current_user");
    expect(sql).toContain("rolsuper");
    expect(sql).toContain("pg_auth_members");
    expect(sql).toContain("has_schema_privilege");
    expect(sql.replace(/'[^']*'/g, "''")).not.toMatch(/\b(insert|update|delete|drop|alter|create|grant|revoke)\b/);
    expect(args[args.indexOf("-h") + 1]).toBe("127.0.0.1");
    expect(args).toContain("ON_ERROR_STOP=1");
  });

  test("the orchestrator refuses a superuser context before applying anything", async () => {
    const docker = createFakeDocker((args) => {
      if (args[0] === "run") {
        return { exitCode: 0, stdout: `${CONTAINER_ID}\n`, stderr: "" };
      }

      if (args[0] === "inspect") {
        return inspectResponse(args);
      }

      if (args[0] === "image") {
        return { exitCode: 0, stdout: JSON.stringify([CLEAN_IMAGE_INSPECT]), stderr: "" };
      }

      if (args[0] === "exec") {
        const inline = args[args.indexOf("-c") + 1] || "";

        if (inline.includes("platform_member")) {
          return {
            exitCode: 0,
            stdout: ROLE_EQUIVALENCE_OK.replace("role:postgres", "role:supabase_admin").replace("superuser:false", "superuser:true"),
            stderr: ""
          };
        }

        if (inline.includes("union all")) {
          return { exitCode: 0, stdout: READY_PROBE, stderr: "" };
        }

        return { exitCode: 0, stdout: "", stderr: "" };
      }

      return { exitCode: 0, stdout: "", stderr: "" };
    });

    const result = await runValidate(docker);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not-platform-equivalent");
    expect(docker.calls.some((call) => call[0] === "cp")).toBe(false);
    expect(docker.calls.some((call) => call[0] === "exec" && call.includes("-f"))).toBe(false);
  });
});

describe("disposable migration container: canonical directory guard", () => {
  test("refuses the legacy migration directory before touching Docker", async () => {
    const docker = createFakeDocker(() => ({ exitCode: 0, stdout: "", stderr: "" }));

    const result = await validate({
      docker,
      container: CONTAINER_ID,
      image: APPROVED_SUPABASE_IMAGE,
      migrationsDirectory: "db/migrations",
      log: () => {},
      logError: () => {}
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("legacy-migrations-directory");
    expect(docker.calls).toEqual([]);
    expect(result.steps.map((step) => step.name)).toEqual(["migrations-directory"]);
    expect(result.steps[0].ok).toBe(false);
  });

  test("refuses an absolute path into the legacy directory too", async () => {
    const docker = createFakeDocker(() => ({ exitCode: 0, stdout: "", stderr: "" }));

    const result = await validate({
      docker,
      container: CONTAINER_ID,
      image: APPROVED_SUPABASE_IMAGE,
      migrationsDirectory: "/checkout/db/migrations",
      log: () => {},
      logError: () => {}
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("legacy-migrations-directory");
    expect(docker.calls).toEqual([]);
  });
});
