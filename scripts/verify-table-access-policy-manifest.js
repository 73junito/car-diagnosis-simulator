#!/usr/bin/env node
"use strict";

/**
 * Deterministic consistency verification for the reviewed table access policy.
 *
 * This does NOT regenerate policy from the database or from grants. It checks
 * the committed manifest against its declared sources - the canonical migration
 * chain - and fails on:
 *
 *   - a canonical table missing from the manifest;
 *   - a manifest entry that is not a canonical table (unknown policy entry);
 *   - an invalid classification;
 *   - an unsupported privilege;
 *   - a policy that contradicts the migrations without recording an owner
 *     decision (a mismatch between the reviewed policy and its declared source).
 *
 * Run: node scripts/verify-table-access-policy-manifest.js
 */

const fs = require("fs");
const path = require("path");

const {
  DEFAULT_MANIFEST_PATH,
  KNOWN_CLASSIFICATIONS,
  loadManifest,
  validateManifest
} = require("./verify-table-access-policy");

const SUPPORTED_PRIVILEGES = Object.freeze([
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER"
]);

const MIGRATIONS_DIRECTORY = path.join("supabase", "migrations");
const APPLICATION_ROLES = Object.freeze(["anon", "authenticated"]);
const OWNER_DECISION_MARKER = "owner decision";

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/** Derive, from the migrations only, what each table's client grants declare. */
function declaredFromMigrations(rootDirectory) {
  const directory = path.join(rootDirectory, MIGRATIONS_DIRECTORY);
  const files = fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
  const tables = new Map();

  for (const file of files) {
    const clean = stripComments(fs.readFileSync(path.join(directory, file), "utf8"));

    for (const match of clean.matchAll(/create table(?: if not exists)?\s+public\.([a-z0-9_]+)/gi)) {
      if (!tables.has(match[1].toLowerCase())) {
        tables.set(match[1].toLowerCase(), { grants: {}, revokes: {} });
      }
    }
  }

  for (const file of files) {
    const clean = stripComments(fs.readFileSync(path.join(directory, file), "utf8"));

    for (const match of clean.matchAll(/\b(grant|revoke)\b[^;]*;/gi)) {
      const statement = match[0].replace(/\s+/g, " ").trim().replace(/;\s*$/, "");
      const kind = match[1].toLowerCase();
      const roleSection = statement.match(/\b(?:to|from)\s+([^;]+)$/i);

      if (!roleSection) continue;

      const roles = APPLICATION_ROLES.filter((role) =>
        new RegExp(`\\b${role}\\b`).test(roleSection[1].toLowerCase())
      );

      if (roles.length === 0) continue;

      for (const [name, entry] of tables) {
        if (!new RegExp(`\\bpublic\\.${name}\\b`).test(statement.toLowerCase())) continue;

        for (const role of roles) {
          const bucket = kind === "grant" ? entry.grants : entry.revokes;

          if (!bucket[role]) bucket[role] = new Set();

          for (const privilege of statement.toLowerCase().matchAll(
            /\b(select|insert|update|delete|truncate|references|trigger|all)\b/g
          )) {
            bucket[role].add(privilege[1] === "all" ? "ALL" : privilege[1].toUpperCase());
          }
        }
      }
    }
  }

  return tables;
}

/**
 * Find privilege mutations built as dynamic SQL, which the static extraction
 * above cannot attribute to a table. Executing arbitrary SQL in JavaScript to
 * infer policy is explicitly not done; instead every dynamic GRANT/REVOKE that
 * names a client role is reported.
 *
 * Only a dynamic GRANT is fatal: it can create access the manifest does not
 * represent. A dynamic REVOKE can only reduce access, and any resulting
 * shortfall is caught by the live audit against the manifest, so it is recorded
 * as informational rather than failing the check.
 */
function dynamicPrivilegeMutations(rootDirectory) {
  const directory = path.join(rootDirectory, MIGRATIONS_DIRECTORY);
  const findings = [];

  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
    const clean = stripComments(fs.readFileSync(path.join(directory, file), "utf8"));

    for (const match of clean.matchAll(/execute\s+(?:immediate\s+)?'([^']*)'/gi)) {
      const sql = match[1].replace(/\s+/g, " ").trim();
      const kind = /\bgrant\b/i.test(sql) ? "grant" : /\brevoke\b/i.test(sql) ? "revoke" : null;

      if (kind === null) continue;

      const mentionsClientRole = APPLICATION_ROLES.some((role) =>
        new RegExp(`\\b${role}\\b`, "i").test(sql)
      );

      findings.push({
        file,
        sql,
        kind,
        mentionsClientRole,
        escalates: kind === "grant" && mentionsClientRole
      });
    }
  }

  return findings;
}

function verifyManifestConsistency({ rootDirectory = path.join(__dirname, ".."), manifest } = {}) {
  const problems = [];
  const policy = manifest || loadManifest(path.join(rootDirectory, DEFAULT_MANIFEST_PATH));
  const entries = policy.tables || {};

  for (const problem of validateManifest(policy)) {
    problems.push(`manifest: ${problem}`);
  }

  const declared = declaredFromMigrations(rootDirectory);

  // Fail closed on privilege escalation the static extraction cannot attribute.
  for (const finding of dynamicPrivilegeMutations(rootDirectory)) {
    if (finding.escalates) {
      problems.push(
        `dynamic privilege escalation: ${finding.file} executes "${finding.sql}" which grants to ` +
          "anon/authenticated and cannot be represented in the manifest"
      );
    }
  }

  for (const table of declared.keys()) {
    if (!(table in entries)) {
      problems.push(`missing table: public.${table} is created by a canonical migration but absent from the manifest`);
    }
  }

  for (const [table, entry] of Object.entries(entries)) {
    if (!declared.has(table)) {
      problems.push(`unknown policy entry: public.${table} is in the manifest but no canonical migration creates it`);
    }

    for (const role of APPLICATION_ROLES) {
      for (const privilege of entry[role] || []) {
        if (!SUPPORTED_PRIVILEGES.includes(String(privilege).toUpperCase())) {
          problems.push(`unsupported privilege: public.${table}.${role} declares "${privilege}"`);
        }
      }
    }

    const source = declared.get(table);

    if (!source) continue;

    const ownerDecision = (entry.authority || []).some((citation) =>
      String(citation).toLowerCase().includes(OWNER_DECISION_MARKER)
    );

    for (const role of APPLICATION_ROLES) {
      const migrationGrants = source.grants[role] ? [...source.grants[role]].sort() : [];
      const manifestGrants = [...(entry[role] || [])].map((value) => String(value).toUpperCase()).sort();

      if (JSON.stringify(migrationGrants) !== JSON.stringify(manifestGrants) && !ownerDecision) {
        problems.push(
          `source mismatch: public.${table}.${role} - migrations declare [${migrationGrants.join(", ")}], ` +
            `manifest declares [${manifestGrants.join(", ")}], and no owner decision is recorded`
        );
      }
    }
  }

  return { ok: problems.length === 0, problems, tableCount: declared.size };
}

if (require.main === module) {
  const result = verifyManifestConsistency();

  if (result.ok) {
    console.log(`[PASS] Table access policy manifest is consistent with its declared sources (${result.tableCount} canonical tables).`);
  } else {
    console.error(`[FAIL] Table access policy manifest has ${result.problems.length} problem(s):`);

    for (const problem of result.problems.slice(0, 40)) {
      console.error(`  ${problem}`);
    }
  }

  process.exitCode = result.ok ? 0 : 1;
}

module.exports = { SUPPORTED_PRIVILEGES, declaredFromMigrations, dynamicPrivilegeMutations, verifyManifestConsistency };
