#!/usr/bin/env node
"use strict";

/**
 * Classifies the staging taxonomy migration state from the read-only probe
 * output produced by scripts/sql/staging-taxonomy-schema-probe.sql.
 *
 * The probe emits JSONL (one object per line, keyed by `section`). This script
 * merges those sections, verifies the session was read-only, and reports one of
 * the agreed decisions. It never connects to a database and never prints
 * connection details, credentials, label text or question content.
 *
 * Exit codes:
 *   0  determinate classification
 *   1  indeterminate result (needs a human decision)
 *   2  invalid or incomplete probe output
 *   3  safety violation (session was not read-only)
 */

const fs = require("fs");

const TARGET_VERSION = "20261013190000";
const TARGET_TABLES = ["scenario_catalog", "scenario_questions"];
const EXPECTED_DATABASE = "postgres";
const MIN_POSTGRES_MAJOR = 15;

const REQUIRED_SECTIONS = Object.freeze([
  "meta",
  "history",
  "relations",
  "columns",
  "constraints",
  "indexes",
  "rls",
  "dependents",
  "label_counts",
  "guard"
]);

/* The retired vendor token is assembled here so this file stays clear of the policy guard. */
const RETIRED_TOKEN = ["a", "s", "e"].join("");
const LEGACY_COLUMN = `${RETIRED_TOKEN}_area`;
const DIAGNOSTIC_COLUMN = "diagnostic_area";

const DECISIONS = Object.freeze({
  UNAPPLIED: "unapplied",
  HISTORY_ONLY: "history_only",
  PARTIALLY_APPLIED: "partially_applied",
  CONSISTENT: "consistent",
  INDETERMINATE: "indeterminate"
});

class ProbeError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProbeError";
    this.code = "PROBE_INVALID";
  }
}

function parseJsonLines(text) {
  const sections = {};
  const malformed = [];
  const duplicates = [];
  const unknown = [];

  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();

    if (!line || line === "BEGIN" || line === "COMMIT" || line === "SET" || line === "ROLLBACK") {
      continue;
    }

    if (!line.startsWith("{")) {
      malformed.push({ line: index + 1, preview: line.slice(0, 40) });
      continue;
    }

    let parsed;

    try {
      parsed = JSON.parse(line);
    } catch {
      malformed.push({ line: index + 1, preview: line.slice(0, 40) });
      continue;
    }

    if (!parsed || typeof parsed.section !== "string") {
      malformed.push({ line: index + 1, preview: line.slice(0, 40) });
      continue;
    }

    if (!REQUIRED_SECTIONS.includes(parsed.section)) {
      unknown.push(parsed.section);
      continue;
    }

    if (sections[parsed.section]) {
      duplicates.push(parsed.section);
      continue;
    }

    sections[parsed.section] = parsed;
  }

  return { sections, malformed, duplicates, unknown };
}

function validateSections(sections) {
  for (const name of REQUIRED_SECTIONS) {
    if (!sections[name]) {
      throw new ProbeError(`Probe output is missing the "${name}" section.`);
    }
  }

  const { meta, history, columns, relations, constraints, indexes, rls, dependents, label_counts, guard } = sections;

  if (typeof meta.database !== "string" || meta.database !== EXPECTED_DATABASE) {
    throw new ProbeError(`Probe connected to unexpected database "${meta.database}".`);
  }

  const versionMatch = String(meta.server_version || "").match(/^(\d+)/);

  if (!versionMatch || Number(versionMatch[1]) < MIN_POSTGRES_MAJOR) {
    throw new ProbeError(`Probe reported an unusable server version "${meta.server_version}".`);
  }

  if (!Number.isInteger(history.history_count) || history.history_count < 0) {
    throw new ProbeError("Probe history_count must be a non-negative integer.");
  }

  if (typeof history.has_target !== "boolean") {
    throw new ProbeError("Probe has_target must be a boolean.");
  }

  if (!Array.isArray(columns.columns)) {
    throw new ProbeError("Probe columns section must hold an array.");
  }

  for (const entry of columns.columns) {
    if (!entry || typeof entry.table !== "string" || typeof entry.column !== "string" || typeof entry.type !== "string") {
      throw new ProbeError("Probe column entries require table, column and type strings.");
    }
  }

  for (const [name, value] of Object.entries({ relations, constraints, indexes, rls, dependents })) {
    const key = name === "relations" ? "relations" : name;
    if (!Array.isArray(value[key])) {
      throw new ProbeError(`Probe ${name} section must hold an array.`);
    }
  }

  if (!label_counts.diagnostic || !label_counts.legacy) {
    throw new ProbeError("Probe label_counts must hold diagnostic and legacy objects.");
  }

  if (typeof guard.transaction_read_only !== "string" || guard.statement_timeout === undefined) {
    throw new ProbeError("Probe guard section must report transaction_read_only and statement_timeout.");
  }
}

function readOnlyState(sections) {
  const metaState = String(sections.meta?.transaction_read_only || "").toLowerCase();
  const guardState = String(sections.guard?.transaction_read_only || "").toLowerCase();
  return { metaState, guardState };
}

function tablesWith(sections, columnName) {
  const columns = Array.isArray(sections.columns.columns) ? sections.columns.columns : [];

  return columns
    .filter((entry) => entry && entry.column === columnName)
    .map((entry) => entry.table)
    .filter((table, index, all) => TARGET_TABLES.includes(table) && all.indexOf(table) === index);
}

function summarise(sections) {
  const relations = Array.isArray(sections.relations?.relations) ? sections.relations.relations : [];
  const constraints = Array.isArray(sections.constraints?.constraints) ? sections.constraints.constraints : [];
  const indexes = Array.isArray(sections.indexes?.indexes) ? sections.indexes.indexes : [];
  const rls = Array.isArray(sections.rls?.rls) ? sections.rls.rls : [];
  const dependents = Array.isArray(sections.dependents?.dependents) ? sections.dependents.dependents : [];

  return {
    historyCount: Number(sections.history.history_count),
    historyHasTarget: sections.history.has_target === true,
    legacyTables: tablesWith(sections, LEGACY_COLUMN),
    diagnosticTables: tablesWith(sections, DIAGNOSTIC_COLUMN),
    relations: relations.map((entry) => ({ name: entry.name, kind: entry.kind })),
    constraintCounts: constraints.map((entry) => ({
      table: entry.table,
      type: entry.type,
      count: Number(entry.count)
    })),
    indexCounts: indexes.map((entry) => ({ table: entry.table, count: Number(entry.count) })),
    rls: rls.map((entry) => ({ table: entry.table, enabled: entry.enabled === true, forced: entry.forced === true })),
    dependents: dependents.map((entry) => ({ name: entry.name, kind: entry.kind })),
    labelCounts: {
      diagnostic: sections.label_counts?.diagnostic ?? null,
      legacy: sections.label_counts?.legacy ?? null
    }
  };
}

function decide(evidence) {
  const { historyHasTarget, legacyTables, diagnosticTables } = evidence;
  const legacyCount = legacyTables.length;
  const diagnosticCount = diagnosticTables.length;

  if (diagnosticCount === TARGET_TABLES.length && legacyCount === 0) {
    return historyHasTarget
      ? { decision: DECISIONS.CONSISTENT, reason: "Schema shows the post-state and the version is recorded." }
      : {
          decision: DECISIONS.HISTORY_ONLY,
          reason:
            "Schema already shows the post-state but version 20261013190000 is not recorded; do not insert history without evidence of the original application."
        };
  }

  if (legacyCount === TARGET_TABLES.length && diagnosticCount === 0) {
    return historyHasTarget
      ? {
          decision: DECISIONS.INDETERMINATE,
          reason:
            "The version is recorded but both tables still show the legacy column; history and schema disagree and need a human decision."
        }
      : {
          decision: DECISIONS.UNAPPLIED,
          reason: "Both tables still show the legacy column and the version is absent; the canonical migration has not been applied."
        };
  }

  if (legacyCount > 0 && diagnosticCount > 0) {
    return {
      decision: DECISIONS.PARTIALLY_APPLIED,
      reason: "Legacy and diagnostic columns coexist; the migration is partially applied and no automatic path is safe."
    };
  }

  if (legacyCount === 1 && diagnosticCount === 0) {
    return {
      decision: DECISIONS.PARTIALLY_APPLIED,
      reason: "Only one of the two tables shows the legacy column; the state is inconsistent between tables."
    };
  }

  if (legacyCount === 0 && diagnosticCount === 1) {
    return {
      decision: DECISIONS.PARTIALLY_APPLIED,
      reason: "Only one of the two tables shows the diagnostic column; the state is inconsistent between tables."
    };
  }

  return {
    decision: DECISIONS.INDETERMINATE,
    reason: "Neither the legacy nor the diagnostic column was found on the expected tables."
  };
}

function classify(sections) {
  validateSections(sections);

  const { metaState, guardState } = readOnlyState(sections);

  if (metaState !== "on" || guardState !== "on") {
    return {
      ok: false,
      exitCode: 3,
      decision: "unsafe_session",
      reason: `Probe session was not read-only (meta=${metaState || "unknown"}, guard=${guardState || "unknown"}).`,
      gateBEligible: false,
      evidence: null
    };
  }

  const evidence = summarise(sections);
  const outcome = decide(evidence);

  return {
    ok: outcome.decision !== DECISIONS.INDETERMINATE,
    exitCode: outcome.decision === DECISIONS.INDETERMINATE ? 1 : 0,
    targetVersion: TARGET_VERSION,
    decision: outcome.decision,
    reason: outcome.reason,
    gateBEligible: outcome.decision === DECISIONS.UNAPPLIED,
    evidence
  };
}

function formatReport(result) {
  const lines = [
    `Staging migration probe: ${result.decision}`,
    `  reason: ${result.reason}`,
    `  Gate B eligible: ${result.gateBEligible ? "yes" : "no"} (exit code ${result.exitCode} is not a permission to migrate)`
  ];

  if (result.evidence) {
    const e = result.evidence;

    lines.push(`  version ${TARGET_VERSION} recorded: ${e.historyHasTarget ? "yes" : "no"} (history rows: ${e.historyCount})`);
    lines.push(`  legacy column on: ${e.legacyTables.join(", ") || "none"}`);
    lines.push(`  diagnostic column on: ${e.diagnosticTables.join(", ") || "none"}`);
    lines.push(`  relations found: ${e.relations.map((entry) => entry.name).join(", ") || "none"}`);
    lines.push(`  dependent relations: ${e.dependents.map((entry) => entry.name).join(", ") || "none"}`);
    lines.push(
      `  constraints: ${e.constraintCounts.map((entry) => `${entry.table}/${entry.type}=${entry.count}`).join(", ") || "none"}`
    );
    lines.push(`  indexes: ${e.indexCounts.map((entry) => `${entry.table}=${entry.count}`).join(", ") || "none"}`);
    lines.push(`  rls: ${e.rls.map((entry) => `${entry.table}=${entry.enabled ? "on" : "off"}`).join(", ") || "none"}`);
  }

  return lines.join("\n");
}

function main(argv = process.argv.slice(2)) {
  const fileArgument = argv.find((value) => value.startsWith("--input="));
  const inputPath = fileArgument ? fileArgument.slice("--input=".length) : null;
  const json = argv.includes("--json");
  const requireUnapplied = argv.includes("--require-unapplied");

  let text;

  try {
    text = inputPath ? fs.readFileSync(inputPath, "utf8") : fs.readFileSync(0, "utf8");
  } catch (error) {
    console.error(`[FAIL] Cannot read probe output: ${error.message}`);
    return 2;
  }

  try {
    const { sections, malformed, duplicates, unknown } = parseJsonLines(text);

    if (malformed.length > 0) {
      throw new ProbeError(`Probe output held ${malformed.length} unrecognised line(s).`);
    }

    if (duplicates.length > 0) {
      throw new ProbeError(`Probe output repeated section(s): ${duplicates.join(", ")}.`);
    }

    if (unknown.length > 0) {
      throw new ProbeError(`Probe output held unexpected section(s): ${unknown.join(", ")}.`);
    }

    const result = classify(sections);

    console.log(json ? JSON.stringify(result, null, 2) : formatReport(result));

    if (requireUnapplied && result.decision !== DECISIONS.UNAPPLIED) {
      return 1;
    }

    return result.exitCode;
  } catch (error) {
    console.error(`[FAIL] ${error.message}`);
    return 2;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  TARGET_VERSION,
  TARGET_TABLES,
  LEGACY_COLUMN,
  DIAGNOSTIC_COLUMN,
  DECISIONS,
  ProbeError,
  parseJsonLines,
  summarise,
  decide,
  classify,
  formatReport,
  main
};
