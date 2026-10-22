"use strict";

/**
 * Regression protection for the staging smoke workflow concurrency groups.
 *
 * Context: `.github/workflows/smoke.yml` and `.github/workflows/api-smoke.yml`
 * previously declared the same job-level concurrency group
 * (`staging-smoke-${{ github.ref }}`). When both queued for the same ref, GitHub
 * superseded the older pending run, so one workflow cancelled the other. That
 * produced a spurious red required check and, because
 * `docs/staging-smoke-concurrency.md` requires the newest `smoke.yml` run for a
 * PR to be a completed success, it could hold the documented verification gate.
 *
 * These tests assert the *structure* of the two workflow files rather than
 * searching the raw text, so a commented-out or unrelated mention of a group
 * string cannot satisfy them. The files are read with a small, dependency-free
 * reader for the YAML subset they use (nested maps, scalars, comments, block
 * scalars). No YAML library is declared in package.json, so one is deliberately
 * not imported here.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LEGACY_SHARED_GROUP = "staging-smoke-${{ github.ref }}";

/** Remove a trailing comment, ignoring `#` inside quoted scalars. */
function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "'" && !inDouble) inSingle = !inSingle;
    else if (char === '"' && !inSingle) inDouble = !inDouble;
    else if (char === "#" && !inSingle && !inDouble && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index);
    }
  }
  return line;
}

const indentOf = (line) => line.match(/^ */)[0].length;
const unquote = (value) => value.replace(/^['"]/, "").replace(/['"]$/, "");

/**
 * Read a YAML block into nested maps. Block scalars (`|`, `>`) are recorded as
 * "<block>" and their bodies skipped, so shell snippets cannot be mistaken for
 * workflow keys. Sequences are not modelled: only the map keys this test reads
 * (`name`, `jobs.<job>.name`, `jobs.<job>.concurrency.*`) are relied upon.
 */
function parseBlock(lines, startIndex, indent) {
  const map = {};
  let index = startIndex;

  while (index < lines.length) {
    const raw = lines[index];
    if (!raw.trim()) { index += 1; continue; }

    const line = stripComment(raw);
    if (!line.trim()) { index += 1; continue; }

    const lineIndent = indentOf(line);
    if (lineIndent < indent) break;
    if (lineIndent > indent) { index += 1; continue; }

    const match = line.trim().match(/^([^:]+):\s*(.*)$/);
    if (!match) { index += 1; continue; }

    const key = unquote(match[1].trim());
    const rest = match[2].trim();

    if (rest === "") {
      let lookahead = index + 1;
      let childIndent = null;
      while (lookahead < lines.length) {
        const candidate = stripComment(lines[lookahead]);
        if (!candidate.trim()) { lookahead += 1; continue; }
        childIndent = indentOf(candidate);
        break;
      }
      if (childIndent === null || childIndent <= lineIndent) {
        map[key] = {};
        index += 1;
      } else {
        const child = parseBlock(lines, index + 1, childIndent);
        map[key] = child.value;
        index = child.index;
      }
      continue;
    }

    if (/^[|>][-+]?$/.test(rest)) {
      map[key] = "<block>";
      index += 1;
      while (index < lines.length) {
        const body = lines[index];
        if (!body.trim()) { index += 1; continue; }
        if (indentOf(body) <= lineIndent) break;
        index += 1;
      }
      continue;
    }

    map[key] = unquote(rest);
    index += 1;
  }

  return { value: map, index };
}

function readWorkflow(relativePath) {
  const text = fs.readFileSync(path.join(ROOT, relativePath), "utf8").replace(/^\uFEFF/, "");
  return parseBlock(text.split(/\r?\n/), 0, 0).value;
}

/** Evaluate a `group:` expression for a concrete GitHub ref. */
const evaluateGroup = (group, ref) => group.replace(/\$\{\{\s*github\.ref\s*\}\}/g, ref);


describe("staging smoke workflow concurrency contract", () => {
  const workflows = {
    "smoke.yml": readWorkflow(".github/workflows/smoke.yml"),
    "api-smoke.yml": readWorkflow(".github/workflows/api-smoke.yml")
  };

  test("both workflows parse and expose exactly one job each", () => {
    for (const [file, doc] of Object.entries(workflows)) {
      expect(`${file}:${typeof doc.name}`).toBe(`${file}:string`);
      expect(doc.jobs).toBeTruthy();
      expect(`${file}:${Object.keys(doc.jobs).join(",")}`).toBe(`${file}:smoke`);
    }
  });

  test("each workflow keeps publishing its required check name", () => {
    expect(workflows["smoke.yml"].jobs.smoke.name).toBe("smoke");
    expect(workflows["api-smoke.yml"].jobs.smoke.name).toBe("api-smoke");
  });

  test("each job declares a job-level concurrency group scoped to the GitHub ref", () => {
    for (const [file, doc] of Object.entries(workflows)) {
      const concurrency = doc.jobs.smoke.concurrency;
      expect(`${file}:${typeof concurrency}`).toBe(`${file}:object`);
      expect(`${file}:${String(concurrency.group).includes("${{ github.ref }}")}`).toBe(`${file}:true`);
    }
  });

  test("cancel-in-progress stays false in both workflows", () => {
    expect(workflows["smoke.yml"].jobs.smoke.concurrency["cancel-in-progress"]).toBe("false");
    expect(workflows["api-smoke.yml"].jobs.smoke.concurrency["cancel-in-progress"]).toBe("false");
  });

  test("the two groups are distinct, so neither workflow can supersede the other", () => {
    const smokeGroup = workflows["smoke.yml"].jobs.smoke.concurrency.group;
    const apiGroup = workflows["api-smoke.yml"].jobs.smoke.concurrency.group;

    expect(smokeGroup).not.toBe(apiGroup);
    expect(smokeGroup).not.toBe(LEGACY_SHARED_GROUP);
    expect(apiGroup).not.toBe(LEGACY_SHARED_GROUP);
  });

  test("the groups stay distinct for every evaluated reference", () => {
    const smokeGroup = workflows["smoke.yml"].jobs.smoke.concurrency.group;
    const apiGroup = workflows["api-smoke.yml"].jobs.smoke.concurrency.group;

    const refs = [
      "refs/pull/1100/merge",
      "refs/pull/1/merge",
      "refs/heads/main",
      "refs/heads/fix/example"
    ];

    for (const ref of refs) {
      const evaluatedSmoke = evaluateGroup(smokeGroup, ref);
      const evaluatedApi = evaluateGroup(apiGroup, ref);
      expect(`${ref}|${evaluatedSmoke}`).not.toBe(`${ref}|${evaluatedApi}`);
      expect(evaluatedSmoke).toContain(ref);
      expect(evaluatedApi).toContain(ref);
    }
  });

  test("the reader reports a shared group faithfully (negative control for the reader)", () => {
    // Guards the reader itself: a file declaring the legacy shared group must
    // read back as exactly that group, so the distinctness assertions above
    // cannot pass on a reader that fails to see the block.
    const shared = [
      "name: Example",
      "",
      "jobs:",
      "  smoke:",
      "    name: smoke",
      "    # a comment naming staging-smoke-auth-${{ github.ref }} must be ignored",
      "    concurrency:",
      "      group: " + LEGACY_SHARED_GROUP,
      "      cancel-in-progress: false",
      "    runs-on: ubuntu-latest",
      ""
    ].join("\n");

    const parsed = parseBlock(shared.split("\n"), 0, 0).value;
    expect(parsed.jobs.smoke.concurrency.group).toBe(LEGACY_SHARED_GROUP);
    expect(parsed.jobs.smoke.concurrency["cancel-in-progress"]).toBe("false");
    expect(parsed.jobs.smoke.name).toBe("smoke");
  });
});

