"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  LEGACY_COLUMN,
  DIAGNOSTIC_COLUMN,
  ProbeError,
  parseJsonLines,
  classify,
  formatReport,
  main
} = require("../scripts/classify-staging-migration-state");

function column(table, name) {
  return { table, column: name, type: "text" };
}

function sectionsFor({
  historyHasTarget = false,
  historyCount = 105,
  legacyTables = [],
  diagnosticTables = [],
  readOnly = "on",
  includeHistory = true
} = {}) {
  const sections = {
    meta: { section: "meta", transaction_read_only: readOnly, database: "postgres", server_version: "17.6.1" },
    guard: { section: "guard", transaction_read_only: readOnly, statement_timeout: "20s" },
    columns: {
      section: "columns",
      columns: [
        ...legacyTables.map((table) => column(table, LEGACY_COLUMN)),
        ...diagnosticTables.map((table) => column(table, DIAGNOSTIC_COLUMN))
      ]
    },
    relations: { section: "relations", relations: [] },
    constraints: { section: "constraints", constraints: [] },
    indexes: { section: "indexes", indexes: [] },
    rls: { section: "rls", rls: [] },
    dependents: { section: "dependents", dependents: [] },
    label_counts: {
      section: "label_counts",
      diagnostic: { present: diagnosticTables.length > 0, nulls: 0, labelled: 0 },
      legacy: { present: legacyTables.length > 0, nulls: 0, labelled: 0 }
    }
  };

  if (includeHistory) {
    sections.history = { section: "history", history_count: historyCount, has_target: historyHasTarget };
  }

  return sections;
}

const both = ["scenario_catalog", "scenario_questions"];

describe("staging migration state classifier (Gate A)", () => {
  test("classifies an unapplied migration", () => {
    const result = classify(sectionsFor({ legacyTables: both }));

    expect(result.decision).toBe("unapplied");
    expect(result.exitCode).toBe(0);
    expect(result.evidence.legacyTables).toEqual(both);
    expect(result.evidence.diagnosticTables).toEqual([]);
    expect(result.evidence.historyHasTarget).toBe(false);
  });

  test("classifies a history-only discrepancy", () => {
    const result = classify(sectionsFor({ diagnosticTables: both }));

    expect(result.decision).toBe("history_only");
    expect(result.exitCode).toBe(0);
    expect(result.reason).toMatch(/do not insert history/i);
  });

  test("classifies a partially applied schema", () => {
    const result = classify(
      sectionsFor({
        legacyTables: ["scenario_catalog"],
        diagnosticTables: ["scenario_questions"]
      })
    );

    expect(result.decision).toBe("partially_applied");
    expect(result.exitCode).toBe(0);
  });

  test("classifies a single-table legacy state as partially applied", () => {
    const result = classify(sectionsFor({ legacyTables: ["scenario_catalog"] }));

    expect(result.decision).toBe("partially_applied");
  });

  test("classifies an inconsistent history and schema combination as indeterminate", () => {
    const result = classify(sectionsFor({ historyHasTarget: true, legacyTables: both }));

    expect(result.decision).toBe("indeterminate");
    expect(result.exitCode).toBe(1);
    expect(result.ok).toBe(false);
  });

  test("classifies a schema with neither column as indeterminate", () => {
    const result = classify(sectionsFor({ historyHasTarget: true }));
    expect(result.decision).toBe("indeterminate");
  });

  test("classifies a fully consistent state", () => {
    const result = classify(sectionsFor({ historyHasTarget: true, historyCount: 106, diagnosticTables: both }));
    expect(result.decision).toBe("consistent");
    expect(result.exitCode).toBe(0);
  });

  test("refuses a session that was not read-only", () => {
    const result = classify(sectionsFor({ legacyTables: both, readOnly: "off" }));

    expect(result.decision).toBe("unsafe_session");
    expect(result.exitCode).toBe(3);
    expect(result.evidence).toBeNull();
  });

  test("fails closed when a required section is missing", () => {
    const sections = sectionsFor({ legacyTables: both });
    delete sections.history;

    expect(() => classify(sections)).toThrow(ProbeError);
  });

  test("ignores psql control lines and reports malformed lines", () => {
    const text = [
      "BEGIN",
      "SET",
      JSON.stringify({ section: "meta", transaction_read_only: "on" }),
      JSON.stringify({ section: "history", history_count: 105, has_target: false }),
      JSON.stringify({ section: "columns", columns: [] }),
      "COMMIT"
    ].join("\n");

    const parsed = parseJsonLines(text);

    expect(parsed.malformed).toEqual([]);
    expect(Object.keys(parsed.sections).sort()).toEqual(["columns", "history", "meta"]);

    const withNoise = parseJsonLines(`${text}\nnot-json\n`);

    expect(withNoise.malformed).toHaveLength(1);
    expect(withNoise.malformed[0].line).toBe(7);
  });

  test("the human report exposes counts only, never label text", () => {
    const sections = sectionsFor({ legacyTables: both });
    sections.label_counts.legacy = { present: true, nulls: 3, labelled: 22 };

    const report = formatReport(classify(sections));

    expect(report).toContain("legacy column on: scenario_catalog, scenario_questions");
    expect(report).not.toMatch(/Starter System|Mechanical Components/);
  });

  test("cli returns the documented exit codes", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "staging-probe-"));

    const writeAll = (name, sections) => {
      const file = path.join(directory, name);
      fs.writeFileSync(file, Object.values(sections).map((section) => JSON.stringify(section)).join("\n"), "utf8");
      return file;
    };

    const good = writeAll("unapplied.jsonl", sectionsFor({ legacyTables: both }));
    const unsafe = writeAll("unsafe.jsonl", sectionsFor({ readOnly: "off" }));
    const indeterminate = writeAll(
      "indeterminate.jsonl",
      sectionsFor({ historyHasTarget: true, legacyTables: both })
    );
    const broken = path.join(directory, "broken.jsonl");

    fs.writeFileSync(broken, "{ not json\n", "utf8");

    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(main([`--input=${good}`])).toBe(0);
    expect(main([`--input=${unsafe}`])).toBe(3);
    expect(main([`--input=${indeterminate}`])).toBe(1);
    expect(main([`--input=${broken}`])).toBe(2);

    log.mockRestore();
    error.mockRestore();
  });
});

describe("staging probe fail-closed handling (Gate A security review)", () => {
  function writeFixture(name, lines) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "staging-probe-safety-"));
    const file = path.join(directory, name);
    fs.writeFileSync(file, lines.join("\n"), "utf8");
    return file;
  }

  function baseLines(sections) {
    return Object.values(sections).map((section) => JSON.stringify(section));
  }

  function run(file, extraArgs = []) {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const code = main([`--input=${file}`, ...extraArgs]);
    log.mockRestore();
    error.mockRestore();
    return code;
  }

  test("rejects a duplicated section instead of trusting the last copy", () => {
    const sections = sectionsFor({ legacyTables: both });
    const lines = baseLines(sections);
    lines.push(JSON.stringify({ section: "history", history_count: 106, has_target: true }));

    expect(run(writeFixture("duplicate.jsonl", lines))).toBe(2);
  });

  test("rejects an unexpected section name", () => {
    const lines = baseLines(sectionsFor({ legacyTables: both }));
    lines.push(JSON.stringify({ section: "row_data", rows: [] }));

    expect(run(writeFixture("unknown.jsonl", lines))).toBe(2);
  });

  test("a partial probe can never be classified as unapplied or consistent", () => {
    const sections = sectionsFor({ legacyTables: both });
    const partial = [sections.meta, sections.history, sections.columns].map((section) => JSON.stringify(section));

    expect(run(writeFixture("partial.jsonl", partial))).toBe(2);
  });

  test("a duplicate guard section cannot flip the read-only verdict", () => {
    const sections = sectionsFor({ diagnosticTables: both });
    const lines = baseLines(sections);
    lines.push(JSON.stringify({ section: "guard", transaction_read_only: "off", statement_timeout: "20s" }));

    expect(run(writeFixture("guard-duplicate.jsonl", lines))).toBe(2);
  });

  test("only an unapplied finding is Gate B eligible", () => {
    const unapplied = classify(sectionsFor({ legacyTables: both }));
    const historyOnly = classify(sectionsFor({ diagnosticTables: both }));
    const partial = classify(
      sectionsFor({ legacyTables: ["scenario_catalog"], diagnosticTables: ["scenario_questions"] })
    );
    const consistent = classify(sectionsFor({ historyHasTarget: true, historyCount: 106, diagnosticTables: both }));

    expect(unapplied.gateBEligible).toBe(true);
    expect(historyOnly.gateBEligible).toBe(false);
    expect(partial.gateBEligible).toBe(false);
    expect(consistent.gateBEligible).toBe(false);
  });

  test("--require-unapplied fails for every non-unapplied determinate state", () => {
    const historyOnly = writeFixture(
      "history-only.jsonl",
      baseLines(sectionsFor({ diagnosticTables: both }))
    );

    expect(run(historyOnly)).toBe(0);
    expect(run(historyOnly, ["--require-unapplied"])).toBe(1);
  });

  test("the report states that exit zero is not permission to migrate", () => {
    const report = formatReport(
      classify(sectionsFor({ legacyTables: ["scenario_catalog"], diagnosticTables: ["scenario_questions"] }))
    );

    expect(report).toContain("Gate B eligible: no");
    expect(report).toContain("is not a permission to migrate");
  });
});
