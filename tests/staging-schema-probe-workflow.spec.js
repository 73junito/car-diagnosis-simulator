"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const workflowPath = path.join(root, ".github", "workflows", "staging-taxonomy-schema-probe.yml");
const sqlPath = path.join(root, "scripts", "sql", "staging-taxonomy-schema-probe.sql");
const classifierPath = path.join(root, "scripts", "classify-staging-migration-state.js");

const workflow = fs.readFileSync(workflowPath, "utf8");
const sql = fs.readFileSync(sqlPath, "utf8");
const classifier = fs.readFileSync(classifierPath, "utf8");

/*
 * Returns one entry per xpath() call in the SQL, describing whether its result
 * is wrapped in parentheses before the array subscript. A bare `xpath(...)[1]`
 * is rejected by PostgreSQL; `(xpath(...))[1]` is the valid form. The scan is
 * deliberately scoped to xpath() calls so unrelated `)[1]` subscripts, which
 * can be valid elsewhere, are never flagged.
 */
function inspectXpathSubscripts(source) {
  const findings = [];
  const marker = /xpath\(/g;
  let match;

  while ((match = marker.exec(source)) !== null) {
    let index = match.index + "xpath(".length;
    let depth = 1;

    while (index < source.length && depth > 0) {
      if (source[index] === "(") depth += 1;
      else if (source[index] === ")") depth -= 1;
      index += 1;
    }

    const beforeCall = source.slice(0, match.index).replace(/\s+$/, "");
    const afterCall = source.slice(index);
    const bareSubscript = /^\s*\[\s*1\s*\]/.test(afterCall);
    const wrappedSubscript = /^\s*\)\s*\[\s*1\s*\]/.test(afterCall);

    findings.push({
      line: source.slice(0, match.index).split(/\r?\n/).length,
      subscripted: bareSubscript || wrappedSubscript,
      bareSubscript,
      wrappedBefore: beforeCall.endsWith("("),
      wrappedAfter: wrappedSubscript
    });
  }

  return findings;
}

describe("staging schema probe workflow and SQL safety (Gate A)", () => {
  test("is manual-only and scoped to the staging environment", () => {
    expect(workflow).toMatch(/^on:\r?\n  workflow_dispatch:/m);
    expect(workflow).not.toMatch(/^\s{2}push:/m);
    expect(workflow).not.toMatch(/^\s{2}pull_request:/m);
    expect(workflow).not.toMatch(/^\s{2}pull_request_target:/m);
    expect(workflow).not.toMatch(/^\s{2}schedule:/m);
    expect(workflow).toContain("environment: jchfruprqpeypdttvlam_staging");
    expect(workflow).toContain("if: inputs.confirm == 'PROBE-STAGING'");
  });

  test("requests read-only permissions only", () => {
    expect(workflow).toMatch(/permissions:\r?\n  contents: read/);
    expect(workflow).not.toMatch(/contents: write/);
    expect(workflow).not.toMatch(/pull-requests: write/);
  });

  test("requires authenticated TLS with certificate verification", () => {
    expect(workflow).toContain("PGSSLMODE: verify-full");
    expect(workflow).toContain("PGSSLROOTCERT:");
    expect(workflow).toContain("STAGING_DB_CA_CERT");
    expect(workflow).not.toMatch(/PGSSLMODE:\s*require\s*$/m);
    expect(workflow).not.toMatch(/PGSSLMODE:\s*disable|PGSSLMODE:\s*allow|PGSSLMODE:\s*prefer/);
  });

  test("cannot reach production or run privileged migration commands", () => {
    expect(workflow).not.toContain("pffdgqpynpbffbcnxmum");
    expect(workflow).not.toMatch(/supabase\s+db\s+/);
    expect(workflow).not.toMatch(/db\s+push|db\s+reset|migration\s+repair/);
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|create|alter|drop|grant|revoke|call)\b/i);
  });

  test("the SQL is a single read-only transaction with a finite timeout", () => {
    expect(sql).toMatch(/^begin read only;/m);
    expect(sql).toMatch(/^commit;/m);
    expect(sql).toMatch(/set local statement_timeout = '20s';/);
    expect(sql).toContain("'section', 'guard'");
    expect(sql).toContain("'transaction_read_only'");

    const beginIndex = sql.search(/^begin read only;/m);
    const guardIndex = sql.indexOf("'section', 'guard'");
    const commitIndex = sql.search(/^commit;/m);

    expect(beginIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(beginIndex);
    expect(commitIndex).toBeGreaterThan(guardIndex);
  });

  test("only the sanitized probe outputs are uploaded", () => {
    const uploadBlock = workflow.slice(workflow.indexOf("Upload read-only probe report"));

    expect(uploadBlock).toContain("probe.jsonl");
    expect(uploadBlock).toContain("probe-report.json");
    expect(uploadBlock).not.toContain(".env");
    expect(uploadBlock).not.toContain("STAGING_DB");
  });

  test("parenthesises every xpath() result before its array subscript", () => {
    const findings = inspectXpathSubscripts(sql);

    expect(findings).toHaveLength(4);

    for (const finding of findings) {
      expect(finding.subscripted).toBe(true);
      expect(finding.bareSubscript).toBe(false);
      expect(finding.wrappedBefore).toBe(true);
      expect(finding.wrappedAfter).toBe(true);
    }
  });

  test("the classifier refuses to treat a determinative exit code as permission", () => {
    expect(classifier).toContain("gateBEligible");
    expect(classifier).toContain("require-unapplied");
    expect(classifier).toContain("is not a permission to migrate");
  });
});
