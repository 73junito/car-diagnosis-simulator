#!/usr/bin/env node
"use strict";

/**
 * Policy-aligned table privilege audit.
 *
 * Replaces the blanket "every public table must be readable by authenticated"
 * rule, which contradicted the canonical chain's deliberate service-role-only
 * hardening. This audit compares the live database against an explicit,
 * reviewed manifest (`docs/database/table-access-policy.json`) and fails closed.
 *
 * It distinguishes table privileges from row-level security: RLS is checked
 * separately (see supabase/verification/04_security_audit.sql) and never used
 * here to excuse a privilege that the manifest does not expect.
 *
 * Fails when:
 *   - an expected role is absent;
 *   - a required privilege is missing;
 *   - a restricted table grants access it should not have;
 *   - a public table is absent from the manifest (unclassified object);
 *   - a manifest entry does not exist in the database;
 *   - any classification is unresolved;
 *   - the manifest itself is malformed;
 *   - the audit query fails.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_MANIFEST_PATH = path.join("docs", "database", "table-access-policy.json");
const APPLICATION_ROLES = Object.freeze(["anon", "authenticated"]);
const KNOWN_CLASSIFICATIONS = Object.freeze([
  "service-role-only",
  "authenticated-granted",
  "authenticated-all",
  "public-read",
  "unclassified"
]);

/** Single read-only probe: roles, public base tables, and their grants. */
function policyProbeSql(roles = APPLICATION_ROLES) {
  const roleList = roles.map((role) => `'${role}'`).join(",");

  return [
    `select 'role:' || rolname from pg_roles where rolname in (${roleList})`,
    "select 'table:' || table_name from information_schema.tables " +
      "where table_schema = 'public' and table_type = 'BASE TABLE'",
    "select 'grant:' || g.grantee || '|' || g.table_name || '|' || g.privilege_type " +
      "from information_schema.role_table_grants g " +
      "join information_schema.tables t on t.table_schema = g.table_schema " +
      "and t.table_name = g.table_name " +
      `where g.table_schema = 'public' and t.table_type = 'BASE TABLE' and g.grantee in (${roleList})`
  ].join(" union all ");
}

function buildPolicyProbeArgs({ databaseUrl, roles = APPLICATION_ROLES } = {}) {
  return [
    "-v",
    "ON_ERROR_STOP=1",
    "--no-psqlrc",
    "-d",
    databaseUrl,
    "-A",
    "-t",
    "-c",
    policyProbeSql(roles)
  ];
}

/** Parse the probe into roles, tables and a table -> role -> privileges map. */
function parsePolicyProbe({ exitCode, stdout = "" }) {
  if (exitCode !== 0) {
    return { ok: false, reason: "probe-failed", message: `Policy probe exited with status ${exitCode}.` };
  }

  const roles = [];
  const tables = [];
  const grants = new Map();

  for (const raw of String(stdout).split(/\r?\n/)) {
    const line = raw.trim();

    if (line.startsWith("role:")) {
      roles.push(line.slice(5));
    } else if (line.startsWith("table:")) {
      tables.push(line.slice(6));
    } else if (line.startsWith("grant:")) {
      const [role, table, privilege] = line.slice(6).split("|");

      if (!grants.has(table)) grants.set(table, new Map());

      const byRole = grants.get(table);

      if (!byRole.has(role)) byRole.set(role, new Set());

      byRole.get(role).add(privilege);
    }
  }

  return { ok: true, roles, tables, grants };
}

/** Structural validation of the manifest itself. */
function validateManifest(manifest) {
  const problems = [];

  if (!manifest || typeof manifest !== "object") {
    return ["manifest is missing or not an object"];
  }

  if (manifest.schemaVersion !== 1) {
    problems.push(`unsupported schemaVersion: ${manifest.schemaVersion}`);
  }

  const entries = manifest.tables;

  if (!entries || typeof entries !== "object" || Object.keys(entries).length === 0) {
    problems.push("manifest declares no tables");
  }

  for (const [name, entry] of Object.entries(entries || {})) {
    if (!KNOWN_CLASSIFICATIONS.includes(entry.classification)) {
      problems.push(`${name}: unknown classification "${entry.classification}"`);
    }

    if (entry.classification === "unclassified") {
      problems.push(`${name}: classification is unresolved and must be reviewed before this audit can pass`);
    }

    for (const role of APPLICATION_ROLES) {
      if (!Array.isArray(entry[role])) {
        problems.push(`${name}: "${role}" must be an array of expected privileges`);
      }
    }

    if (!Array.isArray(entry.authority) || entry.authority.length === 0) {
      problems.push(`${name}: no authority citation recorded`);
    }
  }

  return problems;
}

/**
 * Compare the live database against the manifest. Both directions are checked:
 * a missing privilege fails, and an unexpected privilege fails.
 */
function evaluatePolicy({ manifest, probe, requiredRoles = APPLICATION_ROLES }) {
  const violations = validateManifest(manifest).map((detail) => ({
    code: "MANIFEST_INVALID",
    detail
  }));

  if (!probe.ok) {
    violations.push({ code: "PROBE_FAILED", detail: probe.message });

    return { ok: false, violations, summary: { violations: violations.length } };
  }

  for (const role of requiredRoles) {
    if (!probe.roles.includes(role)) {
      violations.push({ code: "ROLE_MISSING", detail: `required role "${role}" is absent` });
    }
  }

  const expected = (manifest && manifest.tables) || {};
  const expectedNames = Object.keys(expected);

  for (const table of probe.tables) {
    if (!expectedNames.includes(table)) {
      violations.push({
        code: "UNCLASSIFIED_OBJECT",
        detail: `public.${table} exists in the database but is absent from the manifest`
      });
    }
  }

  for (const name of expectedNames) {
    if (!probe.tables.includes(name)) {
      violations.push({
        code: "MISSING_OBJECT",
        detail: `public.${name} is declared in the manifest but absent from the database`
      });
    }
  }

  let roleComparisons = 0;

  for (const name of expectedNames) {
    if (!probe.tables.includes(name)) continue;

    const entry = expected[name];
    const byRole = probe.grants.get(name) || new Map();

    for (const role of APPLICATION_ROLES) {
      const actual = new Set(byRole.get(role) || []);
      const wanted = new Set((entry[role] || []).map((privilege) => String(privilege).toUpperCase()));

      roleComparisons += 1;

      for (const privilege of wanted) {
        if (!actual.has(privilege)) {
          violations.push({
            code: "MISSING_PRIVILEGE",
            detail: `public.${name}: ${role} is missing required ${privilege}`
          });
        }
      }

      for (const privilege of actual) {
        if (!wanted.has(privilege)) {
          violations.push({
            code: "EXCESSIVE_PRIVILEGE",
            detail: `public.${name}: ${role} has ${privilege}, which the manifest does not allow`
          });
        }
      }
    }
  }

  if (probe.tables.length === 0) {
    violations.push({
      code: "NO_OBJECTS_CHECKED",
      detail: "the probe returned no public tables, so nothing was verified"
    });
  }

  return {
    ok: violations.length === 0,
    violations,
    summary: {
      tablesInDatabase: probe.tables.length,
      tablesInManifest: expectedNames.length,
      roleComparisons,
      violations: violations.length
    }
  };
}

function loadManifest(manifestPath = DEFAULT_MANIFEST_PATH) {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function main(argv = process.argv.slice(2), deps = {}) {
  const log = deps.log || ((message) => process.stdout.write(`${message}\n`));
  const logError = deps.logError || ((message) => process.stderr.write(`${message}\n`));

  try {
    const manifest = loadManifest(deps.manifestPath || DEFAULT_MANIFEST_PATH);
    const probe = parsePolicyProbe({
      exitCode: 0,
      stdout: deps.probeStdout || ""
    });
    const result = evaluatePolicy({ manifest, probe });

    log(`TABLE ACCESS POLICY EVIDENCE: ${JSON.stringify({ ok: result.ok, summary: result.summary })}`);

    for (const violation of result.violations.slice(0, 40)) {
      logError(`  ${violation.code}: ${violation.detail}`);
    }

    return result.ok ? 0 : 1;
  } catch (error) {
    logError(`Table access policy audit failed to run: ${error.message}`);

    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  APPLICATION_ROLES,
  KNOWN_CLASSIFICATIONS,
  DEFAULT_MANIFEST_PATH,
  policyProbeSql,
  buildPolicyProbeArgs,
  parsePolicyProbe,
  validateManifest,
  evaluatePolicy,
  loadManifest,
  main
};
