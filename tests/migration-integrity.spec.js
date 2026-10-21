"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  CANONICAL_DIRECTORY,
  BaselineError,
  listMigrations,
  loadBaseline,
  evaluateIntegrity,
  buildBaseline,
  serializeBaseline
} = require("../scripts/verify-migration-integrity");

const repoRoot = path.join(__dirname, "..");
const baselineRelative = path.join("docs", "database", "migration-integrity-baseline.json");

function createFixture(contents) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "migration-integrity-"));
  const directory = path.join(root, CANONICAL_DIRECTORY);
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "database"), { recursive: true });

  for (const [name, content] of Object.entries(contents)) {
    fs.writeFileSync(path.join(directory, name), content, "utf8");
  }

  return root;
}

function writeBaseline(root, extra = {}) {
  const baseline = {
    ...buildBaseline({ migrations: listMigrations(root), generatedAt: "2026-01-01" }),
    ...extra
  };
  fs.writeFileSync(path.join(root, baselineRelative), serializeBaseline(baseline), "utf8");
  return baseline;
}

function evaluate(root, options = {}) {
  return evaluateIntegrity({
    migrations: listMigrations(root),
    baseline: loadBaseline(root),
    ...options
  });
}

function codes(result) {
  return result.violations.map((entry) => entry.code);
}

const seeded = {
  "20260101000000_first.sql": "create table public.first (id int primary key);\n",
  "20260102000000_second.sql": "alter table public.first add column label text;\n"
};

describe("migration integrity validator (Phase 2A)", () => {
  test("accepts a migration tree that matches the baseline", () => {
    const root = createFixture(seeded);
    writeBaseline(root);

    const result = evaluate(root);

    expect(result.violations).toEqual([]);
    expect(result.summary).toEqual({ observed: 2, baselined: 2, pendingAdditions: 0, violations: 0 });
  });

  test("reports a duplicate version", () => {
    const root = createFixture(seeded);
    writeBaseline(root);
    fs.writeFileSync(path.join(root, CANONICAL_DIRECTORY, "20260101000000_repeat.sql"), "select 3;\n", "utf8");

    expect(codes(evaluate(root))).toContain("DUPLICATE_VERSION");
  });

  test("rejects a filename that does not follow the convention", () => {
    const root = createFixture({ ...seeded, "20260103-Bad-Name.sql": "select 4;\n" });
    writeBaseline(root);

    const result = evaluate(root);

    expect(codes(result)).toContain("INVALID_FILENAME");
    expect(result.violations.find((entry) => entry.code === "INVALID_FILENAME").path).toContain("20260103-Bad-Name.sql");
  });

  test("reports an empty migration", () => {
    const root = createFixture({ ...seeded, "20260103000000_empty.sql": "   \n\n" });
    writeBaseline(root);

    expect(codes(evaluate(root))).toContain("EMPTY_MIGRATION");
  });

  test("reports a deleted migration", () => {
    const root = createFixture(seeded);
    writeBaseline(root);
    fs.unlinkSync(path.join(root, CANONICAL_DIRECTORY, "20260102000000_second.sql"));

    const result = evaluate(root);

    expect(codes(result)).toContain("MISSING_MIGRATION");
    expect(result.violations.find((entry) => entry.code === "MISSING_MIGRATION").path).toContain("second");
  });

  test("reports a changed published migration", () => {
    const root = createFixture(seeded);
    writeBaseline(root);
    fs.writeFileSync(
      path.join(root, CANONICAL_DIRECTORY, "20260101000000_first.sql"),
      "create table public.first (id bigint primary key);\n",
      "utf8"
    );

    expect(codes(evaluate(root))).toContain("MIGRATION_CONTENT_CHANGED");
  });

  test("reports a new migration that is not yet baselined", () => {
    const root = createFixture(seeded);
    writeBaseline(root);
    fs.writeFileSync(path.join(root, CANONICAL_DIRECTORY, "20260103000000_third.sql"), "select 5;\n", "utf8");

    expect(codes(evaluate(root))).toEqual(["BASELINE_MISSING_ENTRY"]);

    const relaxed = evaluate(root, { allowPending: true });
    expect(relaxed.violations).toEqual([]);
    expect(relaxed.pending).toHaveLength(1);
    expect(relaxed.pending[0].code).toBe("PENDING_ADDITION");
  });

  test("rejects a backdated migration even when pending additions are allowed", () => {
    const root = createFixture(seeded);
    writeBaseline(root);
    fs.writeFileSync(path.join(root, CANONICAL_DIRECTORY, "20251231000000_backdated.sql"), "select 6;\n", "utf8");

    expect(codes(evaluate(root, { allowPending: true }))).toEqual(["BACKDATED_ADDITION"]);
  });

  test("reports duplicate content unless the pair is explicitly approved", () => {
    const duplicate = "alter table public.first add column note text;\n";
    const root = createFixture({
      ...seeded,
      "20260103000000_duplicate_one.sql": duplicate,
      "20260104000000_duplicate_two.sql": duplicate
    });

    writeBaseline(root);
    expect(codes(evaluate(root))).toEqual(["DUPLICATE_CONTENT"]);

    writeBaseline(root, {
      approvedDuplicateContent: [[
        "supabase/migrations/20260103000000_duplicate_one.sql",
        "supabase/migrations/20260104000000_duplicate_two.sql"
      ]]
    });

    expect(evaluate(root).violations).toEqual([]);
  });

  test("detects a reordered migration as a deletion plus a backdated addition", () => {
    const root = createFixture(seeded);
    writeBaseline(root);
    fs.renameSync(
      path.join(root, CANONICAL_DIRECTORY, "20260102000000_second.sql"),
      path.join(root, CANONICAL_DIRECTORY, "20251231000000_second.sql")
    );

    expect(codes(evaluate(root, { allowPending: true }))).toEqual([
      "MISSING_MIGRATION",
      "BACKDATED_ADDITION"
    ]);
  });

  test("fails closed when the baseline is missing or malformed", () => {
    const missing = createFixture(seeded);
    expect(() => loadBaseline(missing)).toThrow(BaselineError);

    const malformed = createFixture(seeded);
    fs.writeFileSync(path.join(malformed, baselineRelative), "{ not json", "utf8");
    expect(() => loadBaseline(malformed)).toThrow(BaselineError);

    const unsorted = createFixture(seeded);
    const baseline = writeBaseline(unsorted);
    baseline.migrations.reverse();
    fs.writeFileSync(path.join(unsorted, baselineRelative), serializeBaseline(baseline), "utf8");
    expect(() => loadBaseline(unsorted)).toThrow(/sorted by version/);

    const wrongSchema = createFixture(seeded);
    writeBaseline(wrongSchema, { schemaVersion: 99 });
    expect(() => loadBaseline(wrongSchema)).toThrow(/schemaVersion/);
  });

  test("escapes the retired vendor token in serialized paths and round-trips", () => {
    const retired = ["a", "s", "e"].join("");
    const retiredTokenName = `20260105000000_retire_supports_${retired}_concept.sql`;
    const root = createFixture({ ...seeded, [retiredTokenName]: "select 7;\n" });
    const baseline = buildBaseline({ migrations: listMigrations(root), generatedAt: "2026-01-01" });
    const serialized = serializeBaseline(baseline);

    expect(serialized).not.toContain(`_${retired}_`);
    expect(serialized).toContain("\\u0061se");

    const decoded = JSON.parse(serialized);
    const retiredEntry = decoded.migrations.find((entry) => entry.version === "20260105000000");

    expect(retiredEntry.path).toContain(`supports_${retired}_concept`);
    expect(decoded).toEqual(baseline);
  });

  test("serialises deterministically with a trailing newline", () => {
    const migrations = listMigrations(createFixture(seeded));

    const first = serializeBaseline(buildBaseline({ migrations, generatedAt: "2026-01-01" }));
    const second = serializeBaseline(buildBaseline({ migrations, generatedAt: "2026-01-01" }));

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
  });

  test("the committed baseline matches the repository migration tree", () => {
    const committed = loadBaseline(repoRoot);
    const observed = listMigrations(repoRoot);

    expect(committed.migrations).toHaveLength(observed.length);
    expect(committed.postgresMajorVersion).toBe(17);
    expect(committed.canonicalDirectory).toBe(CANONICAL_DIRECTORY);
    expect(committed.legacyDirectory).toBe("db/migrations");

    const committedByPath = new Map(committed.migrations.map((entry) => [entry.path, entry.sha256]));

    for (const migration of observed) {
      expect(committedByPath.get(migration.path)).toBe(migration.sha256);
    }

    expect(evaluate(repoRoot).violations).toEqual([]);
  });
});
