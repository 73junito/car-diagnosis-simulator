"use strict";

/**
 * Disposable Supabase-compatible PostgreSQL container lifecycle for migration
 * validation.
 *
 * Safety properties are asserted rather than assumed:
 *   - the image is the reviewed digest-pinned Supabase PostgreSQL 17 image;
 *   - the container runs with `--network none` and no published ports;
 *   - the container has no host mounts, so nothing on the runner is writable
 *     from inside it;
 *   - the container name is a disposable name and is never a protected one
 *     (this host runs a live local Supabase stack on the same image);
 *   - SQL files reach the container through `docker cp` (a copy), never a bind
 *     mount, and the container is removed when validation finishes.
 *
 * The docker CLI is injected so every assertion is unit-testable without Docker.
 */

const APPROVED_SUPABASE_IMAGE_DIGEST =
  "sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb";
const APPROVED_SUPABASE_IMAGE_REPOSITORY = "ghcr.io/supabase/postgres";
const APPROVED_SUPABASE_IMAGE_TAG = "17.6.1.167";
const APPROVED_SUPABASE_IMAGE =
  `${APPROVED_SUPABASE_IMAGE_REPOSITORY}:${APPROVED_SUPABASE_IMAGE_TAG}@${APPROVED_SUPABASE_IMAGE_DIGEST}`;
// The same reference without the tag. It is the form an image store records in
// `RepoDigests`, so the approved image can be inspected by digest alone.
const APPROVED_SUPABASE_IMAGE_BY_DIGEST =
  `${APPROVED_SUPABASE_IMAGE_REPOSITORY}@${APPROVED_SUPABASE_IMAGE_DIGEST}`;

/**
 * The schemas the image's own initialisation must have created. Exactly eight
 * Supabase schemas, matching the rehearsal record; `information_schema`,
 * `pg_catalog`, `pg_toast` and `pgbouncer` are engine/platform schemas and are
 * deliberately not part of the gate.
 */
const REQUIRED_SCHEMAS = Object.freeze([
  "auth",
  "extensions",
  "graphql",
  "graphql_public",
  "public",
  "realtime",
  "storage",
  "vault"
]);

/** Platform roles the canonical chain and the grants audit depend on. */
const REQUIRED_PLATFORM_ROLES = Object.freeze(["anon", "authenticated", "service_role"]);

/**
 * A relation that proves GoTrue's schema is populated, not merely created.
 *
 * The image's own HEALTHCHECK is only `pg_isready`, which the rehearsal record
 * explicitly warns is not sufficient, and `graphql.seq_schema_version` does not
 * exist in this image version. This probe is the reproducible substitute.
 */
const INIT_PROBE_TABLE = Object.freeze({ schema: "auth", table: "users" });

/** Bookkeeping relation the canonical chain reads but does not create. */
const BOOKKEEPING_SCHEMA = "supabase_migrations";

/** Disposable container names must start with this prefix. */
const DISPOSABLE_NAME_PREFIX = "tm-migval";

/** Names that must never be targeted, whatever else is passed. */
const PROTECTED_NAME_PATTERNS = Object.freeze([/supabase/i, /_db_/i, /^postgres$/i]);

const BOOTSTRAP_SQL =
  `create schema if not exists ${BOOKKEEPING_SCHEMA}; ` +
  `create table if not exists ${BOOKKEEPING_SCHEMA}.schema_migrations (` +
  "version text primary key, statements text[], name text);";

/**
 * One read-only probe that reports everything the initialisation gate needs.
 * Labelled rows keep the parser simple and the output greppable.
 *
 * `start:` is the postmaster start time. The Supabase entrypoint starts the
 * server, shuts it down and starts it again while initialising, so a probe that
 * merely observes the platform objects can succeed during the *first* window and
 * then lose the server. Requiring the start time to repeat proves the cycle has
 * finished.
 */
function initialisationProbeSql() {
  const schemaList = REQUIRED_SCHEMAS.map((name) => `'${name}'`).join(",");
  const roleList = REQUIRED_PLATFORM_ROLES.map((name) => `'${name}'`).join(",");

  return [
    `select 'schema:' || schema_name from information_schema.schemata where schema_name in (${schemaList})`,
    `select 'role:' || rolname from pg_roles where rolname in (${roleList})`,
    "select 'probe:' || count(*)::text from information_schema.tables " +
      `where table_schema = '${INIT_PROBE_TABLE.schema}' and table_name = '${INIT_PROBE_TABLE.table}'`,
    "select 'bookkeeping:' || count(*)::text from information_schema.schemata " +
      `where schema_name = '${BOOKKEEPING_SCHEMA}'`,
    "select 'start:' || extract(epoch from pg_postmaster_start_time())::bigint"
  ].join(" union all ");
}

/**
 * Arguments for the initialisation probe.
 *
 * It connects over TCP on 127.0.0.1 — the same transport the migrations use —
 * so a probe that succeeds proves the server is actually reachable, not merely
 * that a socket file exists during a transient window.
 */
function buildInitialisationProbeArgs({ user = "supabase_admin", database = "postgres" } = {}) {
  return [
    "-h",
    "127.0.0.1",
    "-U",
    user,
    "-d",
    database,
    "-A",
    "-t",
    "-v",
    "ON_ERROR_STOP=1",
    "--no-psqlrc",
    "-c",
    initialisationProbeSql()
  ];
}

/** Reject any container name that is not provably disposable. */
function assertDisposableContainerName(name, { prefix = DISPOSABLE_NAME_PREFIX } = {}) {
  if (typeof name !== "string" || name.trim() === "") {
    return "A container name is required.";
  }

  if (PROTECTED_NAME_PATTERNS.some((pattern) => pattern.test(name))) {
    return `Refusing to operate on "${name}": the name matches a protected pattern.`;
  }

  if (!name.startsWith(prefix)) {
    return `Refusing to operate on "${name}": disposable containers must start with "${prefix}".`;
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) {
    return `Refusing to operate on "${name}": the name is not a valid container name.`;
  }

  return null;
}

/**
 * Extract the isolation-relevant fields from a **container** `docker inspect`.
 *
 * A container inspect carries no `RepoDigests` key at all - only images do - so
 * provenance is deliberately absent here. Reading it from a container silently
 * produced an empty list and disabled the manifest-list fallback it was meant to
 * provide, which is what made the hosted run fail with `isolation-violated`.
 * `imageProvenanceViolations` reads the real metadata instead.
 */
function parseIsolation(inspect) {
  const host = (inspect && inspect.HostConfig) || {};

  // `RepoDigests` is deliberately absent: it is an image-level field, so a
  // container inspection never carries it. Reading it from a container
  // inspection is what made the provenance check look like it worked while
  // always comparing an empty list.
  return {
    networkMode: host.NetworkMode || null,
    binds: Array.isArray(host.Binds) ? host.Binds : [],
    portBindings: host.PortBindings || {},
    mounts: Array.isArray(inspect && inspect.Mounts) ? inspect.Mounts : [],
    imageId: (inspect && inspect.Image) || null
  };
}

/**
 * Establish image provenance for the image a container is running.
 *
 * `docker inspect <container>` reports the image *configuration* id and no
 * digest metadata at all: `RepoDigests` belongs to the image, not to the
 * container. The configuration id is also not the pinned digest whenever the
 * pinned digest is a multi-platform manifest list, because each platform has
 * its own configuration.
 *
 * Provenance is therefore taken from `docker image inspect <image id>`, and
 * proven to describe the running image by requiring the inspected image id to
 * equal the container's image id. Missing metadata, an unreadable inspection,
 * an inspected image that is not the running one, and a digest naming
 * anything other than the approved one all fail closed.
 */
function imageProvenanceViolations({
  imageInspect,
  containerImageId,
  approvedImageId = null,
  expectedDigest = APPROVED_SUPABASE_IMAGE_DIGEST
}) {
  const violations = [];

  if (!imageInspect || typeof imageInspect !== "object") {
    violations.push(
      "Image provenance could not be established: docker image inspect returned no metadata " +
        `for the running image "${containerImageId}".`
    );

    return violations;
  }

  const inspectedId = imageInspect.Id || null;

  if (!inspectedId) {
    violations.push("Image provenance could not be established: the inspected image has no Id.");
  } else if (inspectedId !== containerImageId) {
    violations.push(
      `The inspected image "${inspectedId}" is not the image running in the container "${containerImageId}".`
    );
  }

  const repoDigests = Array.isArray(imageInspect.RepoDigests) ? imageInspect.RepoDigests : [];
  const approvedByRepoDigest = repoDigests.some((entry) => String(entry).endsWith(`@${expectedDigest}`));
  // A single-platform image whose configuration id *is* the approved digest is
  // the approved content by construction, so it needs no digest metadata.
  const approvedById = containerImageId === expectedDigest;
  // The strongest proof, and the one that does not depend on the image store
  // recording any digest metadata at all: the running image is the very image
  // the approved digest resolves to on this platform.
  const approvedByImageId = Boolean(approvedImageId) && approvedImageId === containerImageId;

  if (!approvedByRepoDigest && !approvedById && !approvedByImageId) {
    violations.push(
      `Image must originate from the approved digest ${expectedDigest}; ` +
        `found id "${containerImageId}" with RepoDigests ${JSON.stringify(repoDigests)} ` +
        `and approved image id "${approvedImageId}".`
    );
  }

  return violations;
}

/**
 * Assert the container is genuinely disposable and isolated. Returns a list of
 * violations; an empty list means the container is safe to use.
 *
 * Provenance is proven from `docker image inspect` of the container's own
 * immutable image id, never from the container inspect. `inspect.Image` is the
 * local *configuration* id, which differs from the pinned digest whenever the
 * reference resolves to a platform-specific image, so the two must never be
 * compared directly.
 */
function isolationViolations({
  name,
  inspect,
  imageInspect,
  approvedImageId = null,
  expectedDigest = APPROVED_SUPABASE_IMAGE_DIGEST
}) {
  const violations = [];
  const nameError = assertDisposableContainerName(name);

  if (nameError) {
    violations.push(nameError);
  }

  const isolation = parseIsolation(inspect);

  if (isolation.networkMode !== "none") {
    violations.push(`NetworkMode must be "none"; found "${isolation.networkMode}".`);
  }

  if (isolation.binds.length > 0) {
    violations.push(`Host bind mounts are forbidden; found ${isolation.binds.length}.`);
  }

  if (isolation.mounts.length > 0) {
    violations.push(`Host mounts are forbidden; found ${isolation.mounts.length}.`);
  }

  if (Object.keys(isolation.portBindings).length > 0) {
    violations.push("Published database ports are forbidden; a port binding was found.");
  }

  // Image identity. A container inspection cannot establish it on its own: it
  // carries no digest metadata and its image id is the platform configuration
  // id, not the pinned digest. It is delegated to the image inspection, and
  // the two are correlated by image id.
  violations.push(
    ...imageProvenanceViolations({
      imageInspect,
      containerImageId: isolation.imageId,
      approvedImageId,
      expectedDigest
    })
  );

  return violations;
}

/**
 * Parse the initialisation probe. Reports readiness plus every missing
 * prerequisite, so an abort explains exactly which condition was uncertain.
 */
function classifyInitialisation({ exitCode, stdout = "" }) {
  if (exitCode !== 0) {
    return {
      ready: false,
      reason: "probe-failed",
      schemas: [],
      roles: [],
      probeTablePresent: false,
      bookkeepingPresent: false,
      startEpoch: null,
      missingSchemas: [...REQUIRED_SCHEMAS],
      missingRoles: [...REQUIRED_PLATFORM_ROLES],
      message: `Initialisation probe exited with status ${exitCode}.`
    };
  }

  const lines = String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const schemas = lines.filter((line) => line.startsWith("schema:")).map((line) => line.slice(7));
  const roles = lines.filter((line) => line.startsWith("role:")).map((line) => line.slice(5));
  const probeValue = lines.find((line) => line.startsWith("probe:")) || "probe:0";
  const bookkeepingValue = lines.find((line) => line.startsWith("bookkeeping:")) || "bookkeeping:0";
  const startValue = lines.find((line) => line.startsWith("start:")) || "start:";
  const probeTablePresent = Number(probeValue.slice(6)) > 0;
  const bookkeepingPresent = Number(bookkeepingValue.slice(12)) > 0;
  const startEpoch = startValue.slice(6).trim() || null;

  const missingSchemas = REQUIRED_SCHEMAS.filter((name) => !schemas.includes(name));
  const missingRoles = REQUIRED_PLATFORM_ROLES.filter((name) => !roles.includes(name));
  const problems = [];

  if (missingSchemas.length > 0) {
    problems.push(`missing schema(s): ${missingSchemas.join(", ")}`);
  }

  if (missingRoles.length > 0) {
    problems.push(`missing role(s): ${missingRoles.join(", ")}`);
  }

  if (!probeTablePresent) {
    problems.push(
      `${INIT_PROBE_TABLE.schema}.${INIT_PROBE_TABLE.table} absent (initialisation incomplete)`
    );
  }

  if (bookkeepingPresent) {
    problems.push(
      `${BOOKKEEPING_SCHEMA} already exists, so the instance is not fresh and must not be reused`
    );
  }

  return {
    ready: problems.length === 0,
    reason: problems.length === 0 ? null : "not-ready",
    schemas,
    roles,
    probeTablePresent,
    bookkeepingPresent,
    startEpoch,
    missingSchemas,
    missingRoles,
    message:
      problems.length === 0
        ? `Disposable instance initialised: ${schemas.length} Supabase schema(s), ${roles.length} platform role(s).`
        : `Disposable instance not ready: ${problems.join("; ")}.`
  };
}

/**
 * The role the platform uses to apply migrations.
 *
 * Supabase's `postgres` role is a non-superuser and is NOT a member of
 * `supabase_admin`, so it cannot alter that role's default privileges. That
 * boundary is exactly what the hosted preview hit with SQLSTATE 42501, and a
 * rehearsal that runs as a superuser cannot reproduce it.
 */
const PLATFORM_MIGRATION_ROLE = "postgres";

/** Roles a platform-equivalent migration runner must never be a member of. */
const PLATFORM_MANAGED_ROLES = Object.freeze(["supabase_admin"]);

/**
 * Read-only probe of the execution context: who is running, whether they are a
 * superuser, whether they hold a platform-managed role, and whether they can
 * create objects in `public`.
 */
function roleEquivalenceProbeSql(expectedRole = PLATFORM_MIGRATION_ROLE) {
  const platformRoles = PLATFORM_MANAGED_ROLES.map((role) => `'${role}'`).join(",");

  return [
    "select 'role:' || current_user",
    "select 'session:' || session_user",
    "select 'superuser:' || (select rolsuper::text from pg_roles where rolname = current_user)",
    "select 'platform_member:' || (select count(*)::text from pg_auth_members am " +
      `join pg_roles r on r.oid = am.roleid where r.rolname in (${platformRoles}) ` +
      "and am.member = (select oid from pg_roles where rolname = current_user))",
    "select 'db_owner:' || (select pg_get_userbyid(datdba) from pg_database where datname = current_database())",
    "select 'create_on_public:' || has_schema_privilege(current_user, 'public', 'CREATE')::text",
    `select 'expected_role:' || '${expectedRole}'`
  ].join(" union all ");
}

/** psql arguments for the role-equivalence probe (TCP, matching migrations). */
function buildRoleEquivalenceArgs({ user, database }) {
  return [
    "-h",
    "127.0.0.1",
    "-U",
    user,
    "-d",
    database,
    "-A",
    "-t",
    "-v",
    "ON_ERROR_STOP=1",
    "--no-psqlrc",
    "-c",
    roleEquivalenceProbeSql()
  ];
}

/**
 * Fail closed unless the rehearsal runs as the platform's migration role. A
 * superuser, or a role that can change `supabase_admin` defaults, would produce
 * false confidence: the harness would pass where the platform fails.
 */
function classifyRoleEquivalence({ exitCode, stdout = "", expectedRole = PLATFORM_MIGRATION_ROLE }) {
  if (exitCode !== 0) {
    return {
      ok: false,
      reason: "probe-failed",
      role: null,
      message: `Role equivalence probe exited with status ${exitCode}.`
    };
  }

  const lines = String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const value = (prefix) => {
    const match = lines.find((line) => line.startsWith(prefix));

    return match ? match.slice(prefix.length) : "";
  };

  const role = value("role:");
  const sessionRole = value("session:");
  const superuser = value("superuser:") === "true";
  const platformMember = Number(value("platform_member:") || "0") > 0;
  const dbOwner = value("db_owner:");
  const createOnPublic = value("create_on_public:") === "true";
  const problems = [];

  if (superuser) {
    problems.push(
      `execution role "${role}" is a superuser, so the rehearsal would not reproduce the hosted permission boundary`
    );
  }

  if (platformMember) {
    problems.push(
      `execution role "${role}" is a member of a platform-managed role (${PLATFORM_MANAGED_ROLES.join(", ")}), ` +
        "so it could change defaults the platform protects"
    );
  }

  if (role !== expectedRole) {
    problems.push(`expected the platform migration role "${expectedRole}"; found "${role}"`);
  }

  if (!createOnPublic) {
    problems.push(`role "${role}" cannot CREATE in schema public, so it cannot apply migrations`);
  }

  return {
    ok: problems.length === 0,
    reason: problems.length === 0 ? null : "not-platform-equivalent",
    role,
    sessionRole,
    superuser,
    platformMember,
    dbOwner,
    createOnPublic,
    message:
      problems.length === 0
        ? `Platform-equivalent migration role confirmed: ${role} (non-superuser, not a member of ${PLATFORM_MANAGED_ROLES.join("/")})`
        : `Rehearsal is not platform-equivalent: ${problems.join("; ")}.`
  };
}

module.exports = {
  APPROVED_SUPABASE_IMAGE,
  APPROVED_SUPABASE_IMAGE_BY_DIGEST,
  APPROVED_SUPABASE_IMAGE_DIGEST,
  APPROVED_SUPABASE_IMAGE_REPOSITORY,
  APPROVED_SUPABASE_IMAGE_TAG,
  REQUIRED_SCHEMAS,
  REQUIRED_PLATFORM_ROLES,
  INIT_PROBE_TABLE,
  BOOKKEEPING_SCHEMA,
  BOOTSTRAP_SQL,
  DISPOSABLE_NAME_PREFIX,
  PROTECTED_NAME_PATTERNS,
  PLATFORM_MIGRATION_ROLE,
  PLATFORM_MANAGED_ROLES,
  initialisationProbeSql,
  buildInitialisationProbeArgs,
  roleEquivalenceProbeSql,
  buildRoleEquivalenceArgs,
  classifyRoleEquivalence,
  assertDisposableContainerName,
  parseIsolation,
  imageProvenanceViolations,
  isolationViolations,
  classifyInitialisation
};
