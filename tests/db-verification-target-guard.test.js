"use strict";
// Safety tests for the disposable-database guard shared by the two LMF database harnesses.
//
// These run the real harness executables as child processes with deliberately bad targets and
// assert they refuse before connecting. No database is required: every case either stops at the
// guard or fails to connect to a loopback port where nothing is listening.

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "..");
const GUARD = "Local disposable LMF database required";
const WORKFLOW = path.join(ROOT, ".github", "workflows", "lmf-db-verification.yml");

const HARNESSES = [
  {
    name: "concurrency",
    script: "tests/lmf-db-concurrency.cjs",
    goodDb: "lmf_concurrency_verify",
    otherDb: "lmf_rotation_verify",
  },
  {
    name: "key rotation",
    script: "tests/lmf-db-key-rotation.cjs",
    goodDb: "lmf_rotation_verify",
    otherDb: "lmf_concurrency_verify",
  },
];

function runHarness(script, url) {
  const env = { ...process.env };
  if (url === undefined) delete env.LMF_TEST_DATABASE_URL;
  else env.LMF_TEST_DATABASE_URL = url;
  const started = Date.now();
  const result = spawnSync(process.execPath, [path.join(ROOT, script)], {
    cwd: ROOT,
    env,
    encoding: "utf8",
    timeout: 20000,
  });
  return {
    status: result.status,
    output: `${result.stdout || ""}${result.stderr || ""}`,
    ms: Date.now() - started,
  };
}

describe.each(HARNESSES)("$name harness disposable-target guard", ({ script, goodDb, otherDb }) => {
  it("rejects an external host even when the database name is correct", () => {
    const result = runHarness(script, `postgresql://u:p@db.example.com:5432/${goodDb}`);
    expect(result.status).toBe(1);
    expect(result.output).toContain(GUARD);
    // A rejected target must never reach the network.
    expect(result.output).not.toMatch(/ECONNREFUSED|ENOTFOUND|getaddrinfo|ETIMEDOUT/);
    expect(result.ms).toBeLessThan(5000);
  });

  it("rejects a loopback host when the database name is not the verification database", () => {
    const result = runHarness(script, `postgresql://u:p@localhost:5432/${otherDb}`);
    expect(result.status).toBe(1);
    expect(result.output).toContain(GUARD);
    expect(result.output).not.toMatch(/ECONNREFUSED|ENOTFOUND|getaddrinfo|ETIMEDOUT/);
  });

  it("fails closed when the database URL is missing", () => {
    const result = runHarness(script, undefined);
    expect(result.status).toBe(1);
    // The two harnesses word this differently ("Disposable LMF database required" vs
    // "Local disposable LMF database required"). Fail-closed is the property under test here.
    expect(result.output).toMatch(/disposable .*database required/i);
    expect(result.output).not.toMatch(/ECONNREFUSED|ENOTFOUND|getaddrinfo/);
  });

  it("fails closed when the database URL is malformed", () => {
    const result = runHarness(script, "not-a-database-url");
    expect(result.status).toBe(1);
    // The rotation harness maps a parse failure onto its guard message; the concurrency harness
    // surfaces the parser's own "Invalid URL". Both refuse to continue, which is the guarantee.
    expect(result.output).toMatch(/disposable .*database required|invalid url/i);
    expect(result.output).not.toMatch(/ECONNREFUSED|ENOTFOUND|getaddrinfo/);
  });

  it("accepts a loopback URL naming the exact disposable database", () => {
    // Port 59999 has nothing listening: passing the guard must surface a connection error,
    // which is how we know validation let it through.
    const result = runHarness(script, `postgresql://u:p@127.0.0.1:59999/${goodDb}`);
    expect(result.output).not.toContain(GUARD);
    expect(result.output).toMatch(/ECONNREFUSED/);
    expect(result.status).toBe(1);
  });
});

describe("lmf-db-verification workflow contract", () => {
  const workflow = fs.readFileSync(WORKFLOW, "utf8");

  it("executes both harnesses by name", () => {
    expect(workflow).toContain("node tests/lmf-db-concurrency.cjs");
    expect(workflow).toContain("node tests/lmf-db-key-rotation.cjs");
  });

  it("uses no repository secrets or variables", () => {
    expect(workflow).not.toMatch(/\bsecrets\./);
    expect(workflow).not.toMatch(/\bvars\./);
  });

  it("declares read-only permissions", () => {
    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read/);
  });

  it("tears down disposable databases even after a failure", () => {
    expect(workflow).toMatch(/if: always\(\)/);
  });

  it("targets a container image rather than a hosted project", () => {
    expect(workflow).toMatch(/image: postgres:\d+/);
    expect(workflow).not.toMatch(/supabase\.co/);
  });
});
