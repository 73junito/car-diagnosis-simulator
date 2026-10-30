"use strict";

/*
 * Regression contract for the GHCR bounded pre-pull in apply-migrations.yml.
 *
 * The disposable migration validation job once failed in ~6 s with
 * `toomanyrequests` from ghcr.io, before a single migration was applied. The fix
 * adds a bounded, backoff-retried pre-pull outside the validator. This file locks
 * that guard in place so a later edit cannot silently remove the attempt bound,
 * the step timeout, the fail-closed exit, or the single-source digest.
 *
 * `inspectPrepullGuard` is pure - it takes a workflow source string and returns
 * violations. That is what makes the negative controls possible: each one mutates
 * a copy of the real workflow and asserts the same inspection rejects it, proving
 * the assertions are sensitive rather than vacuous.
 */

const fs = require("fs");
const path = require("path");

const yaml = require("js-yaml");

const root = path.join(__dirname, "..");
const workflowPath = path.join(root, ".github", "workflows", "apply-migrations.yml");

const MAX_ATTEMPTS = 5;
const MAX_STEP_MINUTES = 8;
const DIGEST_PATTERN = /sha256:[0-9a-f]{64}/i;

function findStep(steps, predicate) {
  return steps.findIndex((step) => step && predicate(step));
}

function inspectPrepullGuard(source) {
  const violations = [];
  const record = (code, detail) => violations.push({ code, detail });

  let doc;

  try {
    doc = yaml.load(source);
  } catch (error) {
    return { ok: false, violations: [{ code: "unparseable-yaml", detail: String(error && error.message) }] };
  }

  const steps = doc && doc.jobs && doc.jobs["apply-migrations"] && doc.jobs["apply-migrations"].steps;

  if (!Array.isArray(steps)) {
    return { ok: false, violations: [{ code: "missing-steps", detail: "apply-migrations has no steps array" }] };
  }

  const resolveIndex = findStep(steps, (s) => String(s.name || "").includes("Resolve the pinned migration image"));
  const pullIndex = findStep(steps, (s) => String(s.name || "").includes("Pre-pull"));
  const validateIndex = findStep(steps, (s) => String(s.run || "").includes("validate-migrations-disposable.js"));

  if (resolveIndex === -1) record("missing-resolve-step", "no step resolves the pinned image");
  if (pullIndex === -1) record("missing-prepull-step", "no bounded pre-pull step");
  if (validateIndex === -1) record("missing-validate-step", "no migration validation step");

  // The pre-pull must run before validation, and resolution before the pull, so a
  // failed pull can never be followed by validation in the same job.
  if (pullIndex !== -1 && validateIndex !== -1 && pullIndex > validateIndex) {
    record("prepull-after-validate", "pre-pull is ordered after the validation step");
  }

  if (resolveIndex !== -1 && pullIndex !== -1 && resolveIndex > pullIndex) {
    record("resolve-after-prepull", "image resolution is ordered after the pull");
  }

  if (resolveIndex !== -1) {
    const run = String(steps[resolveIndex].run || "");

    if (!run.includes("APPROVED_SUPABASE_IMAGE")) {
      record("digest-not-from-harness", "resolution does not read the harness export");
    }

    if (DIGEST_PATTERN.test(run)) {
      record("hardcoded-digest-in-resolve", "resolution embeds a literal digest");
    }
  }

  if (pullIndex !== -1) {
    const step = steps[pullIndex];
    const run = String(step.run || "");
    const timeout = Number(step["timeout-minutes"]);

    if (!Number.isFinite(timeout) || timeout <= 0) {
      record("missing-timeout", "pre-pull has no finite step timeout");
    } else if (timeout > MAX_STEP_MINUTES) {
      record("timeout-too-large", `pre-pull timeout ${timeout}m exceeds ${MAX_STEP_MINUTES}m`);
    }

    if (DIGEST_PATTERN.test(run)) {
      record("hardcoded-digest-in-pull", "pre-pull embeds a literal digest instead of the resolved image");
    }

    const loop = run.match(/for attempt in ([0-9 ]+?);/);

    if (!loop) {
      record("unbounded-loop", "no bounded 'for attempt in ...' loop");
    } else {
      const attempts = loop[1].trim().split(/\s+/).map(Number);
      const last = attempts[attempts.length - 1];

      if (attempts.length !== MAX_ATTEMPTS) {
        record("attempt-count", `loop allows ${attempts.length} attempts, expected ${MAX_ATTEMPTS}`);
      }

      if (last !== MAX_ATTEMPTS) {
        record("attempt-max", `last attempt is ${last}, expected ${MAX_ATTEMPTS}`);
      }

      if (!new RegExp(`\\[\\s*"\\$attempt"\\s+-eq\\s+${last}\\s*\\]`).test(run)) {
        record("no-break-at-last", "loop does not break before re-sleeping on the final attempt");
      }
    }

    if (!run.includes("delay=$(( 5 * (2 ** (attempt - 1)) ))")) {
      record("no-backoff", "no bounded exponential backoff");
    }

    if (!run.includes('sleep "$delay"')) {
      record("no-sleep", "backoff delay is never applied");
    }

    if (!/(^|\n)\s*exit 1\b/.test(run)) {
      record("no-nonzero-exit", "pre-pull can fall through without a non-zero exit");
    }

    if (!run.includes("::error::")) {
      record("no-error-annotation", "exhaustion is not annotated for the run log");
    }

    if (!String((step.env && step.env.IMAGE) || "").includes("steps.migration-image.outputs.image")) {
      record("pull-not-using-resolved-image", "pre-pull does not consume the resolved image output");
    }

    if (step["continue-on-error"]) {
      record("continue-on-error", "a failed pull would not stop the job");
    }
  }

  if (validateIndex !== -1) {
    const validate = steps[validateIndex];

    if (validate["continue-on-error"]) {
      record("validate-continue-on-error", "validation failure would not stop the job");
    }

    if (String(validate.if || "").includes("always()")) {
      record("validate-runs-always", "validation is forced to run even after a failed pre-pull");
    }
  }

  return { ok: violations.length === 0, violations };
}

const workflowSource = fs.readFileSync(workflowPath, "utf8");

function loadSteps(source) {
  return yaml.load(source).jobs["apply-migrations"].steps;
}

function codesFor(source) {
  return inspectPrepullGuard(source).violations.map((violation) => violation.code);
}

describe("GHCR bounded pre-pull workflow contract", () => {
  test("the committed workflow satisfies every guard", () => {
    const result = inspectPrepullGuard(workflowSource);

    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("the pinned image comes from the harness export, with no literal digest anywhere", () => {
    const resolve = loadSteps(workflowSource).find((step) =>
      String(step.name || "").includes("Resolve the pinned migration image")
    );

    expect(resolve.run).toContain("APPROVED_SUPABASE_IMAGE");
    expect(DIGEST_PATTERN.test(resolve.run)).toBe(false);
    expect(DIGEST_PATTERN.test(workflowSource)).toBe(false);
  });

  test("the pre-pull bounds itself to five attempts, applies backoff, and fails non-zero", () => {
    const pull = loadSteps(workflowSource).find((step) => String(step.name || "").includes("Pre-pull"));

    expect(pull.run).toContain("for attempt in 1 2 3 4 5;");
    expect(pull.run).toContain('if [ "$attempt" -eq 5 ]; then');
    expect(pull.run).toContain("delay=$(( 5 * (2 ** (attempt - 1)) ))");
    expect(pull.run).toContain('sleep "$delay"');
    expect(pull.run).toContain("exit 1");
    expect(pull.run).toContain("::error::");
    expect(pull["timeout-minutes"]).toBe(MAX_STEP_MINUTES);
  });

  test("the pre-pull runs before validation, and validation cannot be forced to run after a failure", () => {
    const steps = loadSteps(workflowSource);
    const names = steps.map((step) => String(step.name || "").trim());
    const pullIndex = names.findIndex((name) => name.startsWith("Pre-pull"));
    const validateIndex = names.indexOf("Validate canonical migrations against disposable Supabase Postgres");

    expect(pullIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeGreaterThan(pullIndex);
    expect(steps[pullIndex]["continue-on-error"]).toBeFalsy();
    expect(steps[validateIndex]["continue-on-error"]).toBeFalsy();
    expect(String(steps[validateIndex].if || "")).not.toContain("always()");
  });

  describe("negative controls - each mutation must be rejected", () => {
    const mutations = [
      ["an unbounded loop", (s) => s.replace(/for attempt in 1 2 3 4 5; do/, "while true; do"), "unbounded-loop"],
      ["only three attempts", (s) => s.replace(/for attempt in 1 2 3 4 5; do/, "for attempt in 1 2 3; do"), "attempt-count"],
      ["no break on the last attempt", (s) => s.replace(/\[ "\$attempt" -eq 5 \]/, '[ "$attempt" -eq 99 ]'), "no-break-at-last"],
      ["a flat retry with no backoff", (s) => s.replace(/delay=\$\(\( 5 \* \(2 \*\* \(attempt - 1\)\) \)\)/, "delay=0"), "no-backoff"],
      ["a backoff that is never applied", (s) => s.replace(/sleep "\$delay"/, "true"), "no-sleep"],
      ["no non-zero exit after exhaustion", (s) => s.replace(/after 5 bounded attempts\."\s*\r?\n\s*exit 1/, 'after 5 bounded attempts."'), "no-nonzero-exit"],
      ["no step timeout", (s) => s.replace(/\n[ ]*timeout-minutes: 8\r?\n/, "\n"), "missing-timeout"],
      ["a timeout larger than the bound", (s) => s.replace(/timeout-minutes: 8/, "timeout-minutes: 30"), "timeout-too-large"],
      ["a hardcoded digest in the pull", (s) => s.replace(/docker pull "\$IMAGE"/, `docker pull "ghcr.io/supabase/postgres@sha256:${"a".repeat(64)}"`), "hardcoded-digest-in-pull"],
      ["the resolved image ignored", (s) => s.replace(/steps\.migration-image\.outputs\.image/, "secrets.SOME_IMAGE"), "pull-not-using-resolved-image"],
      ["the digest not taken from the harness", (s) => s.replace(/APPROVED_SUPABASE_IMAGE/, "'ghcr.io/supabase/postgres:latest'"), "digest-not-from-harness"],
      ["a pull that tolerates failure", (s) => s.replace(/(\n[ ]*timeout-minutes: 8\r?\n)/, "$1        continue-on-error: true\n"), "continue-on-error"]
    ];

    test.each(mutations)("rejects %s", (_label, mutate, expectedCode) => {
      const mutated = mutate(workflowSource);

      expect(mutated).not.toBe(workflowSource);
      expect(codesFor(mutated)).toContain(expectedCode);
    });
  });

  describe("step ordering", () => {
    const synthetic = (order) =>
      [
        "name: synthetic",
        "jobs:",
        "  apply-migrations:",
        "    steps:",
        ...order.flatMap((kind) => {
          if (kind === "resolve") {
            return ["      - name: Resolve the pinned migration image", "        run: echo APPROVED_SUPABASE_IMAGE"];
          }

          if (kind === "pull") {
            return [
              "      - name: Pre-pull the pinned migration image (bounded retry)",
              "        timeout-minutes: 8",
              "        run: exit 1"
            ];
          }

          return [
            "      - name: Validate canonical migrations against disposable Supabase Postgres",
            "        run: node scripts/validate-migrations-disposable.js"
          ];
        })
      ].join("\n");

    test("validation ordered before the pre-pull is rejected", () => {
      expect(codesFor(synthetic(["validate", "resolve", "pull"]))).toContain("prepull-after-validate");
    });

    test("a pre-pull ordered before resolution is rejected", () => {
      expect(codesFor(synthetic(["pull", "resolve", "validate"]))).toContain("resolve-after-prepull");
    });
  });
});

/*
 * Regression contract for the best-effort GHCR authentication wrapped around the
 * bounded pre-pull.
 *
 * Manual diagnostic run 39892068108 proved that this repository's GITHUB_TOKEN can
 * authenticate to ghcr.io and pull the approved digest. It did not prove that
 * authentication caused that pull to succeed, nor that it removes the shared
 * runner's anonymous rate limiting. The login is therefore deliberately
 * best-effort while the pull stays fail-closed, and this file locks that asymmetry
 * in place: an edit that made the login fatal, leaked the token, widened the job's
 * token scope, or dropped the anonymous fallback is rejected here.
 *
 * `inspectGhcrAuth` is pure, which is what makes the negative controls possible.
 */
function inspectGhcrAuth(source) {
  const violations = [];
  const record = (code, detail) => violations.push({ code, detail });

  let doc;

  try {
    doc = yaml.load(source);
  } catch (error) {
    return { ok: false, violations: [{ code: "unparseable-yaml", detail: String(error && error.message) }] };
  }

  const job = doc && doc.jobs && doc.jobs["apply-migrations"];
  const steps = job && job.steps;

  if (!Array.isArray(steps)) {
    return { ok: false, violations: [{ code: "missing-steps", detail: "apply-migrations has no steps array" }] };
  }

  // The job must carry its own scope block. Inheriting the workflow-level block
  // would hand the migration job `pull-requests: write`, which it never uses.
  const permissions = job.permissions && typeof job.permissions === "object" ? job.permissions : null;

  if (!permissions) {
    record("missing-job-permissions", "the migration job declares no job-level permissions");
  } else {
    if (permissions.contents !== "read") {
      record("missing-contents-read", "job-level permissions do not grant contents: read");
    }

    if (permissions.packages !== "read") {
      record("missing-packages-read", "job-level permissions do not grant packages: read");
    }

    if (permissions["pull-requests"]) {
      record("job-writes-to-pull-request", "the migration job does not need a pull-request scope");
    }
  }

  const resolveIndex = findStep(steps, (s) => String(s.name || "").includes("Resolve the pinned migration image"));
  const authIndex = findStep(steps, (s) => String(s.name || "").includes("Authenticate to ghcr.io"));
  const pullIndex = findStep(steps, (s) => String(s.name || "").includes("Pre-pull"));
  const logoutIndex = findStep(steps, (s) => String(s.name || "").includes("Log out of ghcr.io"));
  const validateIndex = findStep(steps, (s) => String(s.run || "").includes("validate-migrations-disposable.js"));

  if (authIndex === -1) record("missing-auth-step", "no ghcr.io authentication step");
  if (logoutIndex === -1) record("missing-logout-step", "no ghcr.io logout step");

  if (authIndex !== -1) {
    const step = steps[authIndex];
    const run = String(step.run || "");
    const env = step.env || {};

    if (!run.includes("--password-stdin")) {
      record("no-password-stdin", "the token is not supplied through stdin");
    }

    if (!/secrets\.GITHUB_TOKEN/.test(String(env.GHCR_TOKEN || ""))) {
      record("token-not-github-token", "login does not use GITHUB_TOKEN");
    }

    if (!/github\.actor/.test(String(env.GHCR_ACTOR || ""))) {
      record("actor-not-github-actor", "login does not use github.actor");
    }

    const tokenReferences = (run.match(/GHCR_TOKEN/g) || []).length;

    if (tokenReferences !== 1) {
      record("token-referenced-too-often", `GHCR_TOKEN appears ${tokenReferences} times; only the stdin pipeline may read it`);
    }

    if (/\becho\b[^\n]*GHCR_TOKEN/.test(run)) {
      record("token-echoed", "the token is echoed");
    }

    if (!run.includes("raw docker login output withheld")) {
      record("raw-login-output-not-withheld", "raw docker login output is not explicitly withheld");
    }

    if (/cat\s+[^\n]*ghcr-login\.out/.test(run)) {
      record("raw-login-output-printed", "the login output file is printed");
    }

    if (!/(^|\r?\n)[ \t]*exit 0\b/.test(run)) {
      record("no-fallback-exit", "the authentication step has no non-fatal fallback");
    }

    if (/(^|\r?\n)[ \t]*exit 1\b/.test(run)) {
      record("auth-step-fails-job", "the authentication step can fail the job");
    }

    if (!run.includes("status=authenticated")) {
      record("no-authenticated-status", "the authenticated path is not reported");
    }

    if (!run.includes("status=anonymous-fallback")) {
      record("no-fallback-status", "the anonymous fallback path is not reported");
    }

    if (!run.includes("::warning::")) {
      record("no-auth-warning", "a failed authentication is not annotated");
    }
  }

  if (logoutIndex !== -1) {
    if (String(steps[logoutIndex].if || "").trim() !== "always()") {
      record("logout-not-always", "logout does not run with if: always()");
    }

    if (!String(steps[logoutIndex].run || "").includes("docker logout ghcr.io")) {
      record("logout-does-not-logout", "the logout step does not log out of ghcr.io");
    }
  }

  if (pullIndex !== -1) {
    const env = steps[pullIndex].env || {};

    if (!String(env.AUTH_STATUS || "").includes("steps.ghcr-auth.outputs.status")) {
      record("pull-not-reporting-auth-path", "the pull does not report which authentication path was taken");
    }
  }

  if (resolveIndex !== -1 && authIndex !== -1 && authIndex < resolveIndex) {
    record("auth-before-resolve", "authentication runs before the image is resolved");
  }

  if (authIndex !== -1 && pullIndex !== -1 && authIndex > pullIndex) {
    record("auth-after-pull", "authentication runs after the pull");
  }

  if (logoutIndex !== -1 && pullIndex !== -1 && logoutIndex < pullIndex) {
    record("logout-before-pull", "logout runs before the credential is used");
  }

  if (logoutIndex !== -1 && validateIndex !== -1 && logoutIndex > validateIndex) {
    record("logout-after-validate", "logout is not reached before validation");
  }

  if (DIGEST_PATTERN.test(source)) {
    record("hardcoded-digest", "the workflow embeds a literal digest instead of the harness export");
  }

  return { ok: violations.length === 0, violations };
}

describe("GHCR authenticated pull integration contract", () => {
  const codesForAuth = (source) => inspectGhcrAuth(source).violations.map((violation) => violation.code);

  test("the committed workflow satisfies every authentication guard", () => {
    const result = inspectGhcrAuth(workflowSource);

    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("the migration job asks only for contents: read and packages: read", () => {
    const job = yaml.load(workflowSource).jobs["apply-migrations"];

    expect(job.permissions).toEqual({ contents: "read", packages: "read" });
  });

  test("credentials are supplied only through stdin and are never printed", () => {
    const auth = loadSteps(workflowSource).find((step) =>
      String(step.name || "").includes("Authenticate to ghcr.io")
    );

    expect(auth.env.GHCR_TOKEN).toBe("${{ secrets.GITHUB_TOKEN }}");
    expect(auth.env.GHCR_ACTOR).toBe("${{ github.actor }}");
    expect(auth.run).toContain("--password-stdin");
    expect(auth.run).toContain("raw docker login output withheld");
    expect((auth.run.match(/GHCR_TOKEN/g) || []).length).toBe(1);
  });

  test("authentication is best-effort while the pull stays fail-closed", () => {
    const steps = loadSteps(workflowSource);
    const auth = steps.find((step) => String(step.name || "").includes("Authenticate to ghcr.io"));
    const pull = steps.find((step) => String(step.name || "").includes("Pre-pull"));

    expect(auth.run).toContain("exit 0");
    expect(auth.run).not.toContain("exit 1");
    expect(auth["continue-on-error"]).toBeFalsy();
    expect(pull["continue-on-error"]).toBeFalsy();
    expect(pull.run).toContain("exit 1");
    expect(pull.run).toContain("for attempt in 1 2 3 4 5;");
    expect(pull.run).toContain('sleep "$delay"');
    expect(pull["timeout-minutes"]).toBe(MAX_STEP_MINUTES);
  });

  test("the pull reports which authentication path was taken", () => {
    const pull = loadSteps(workflowSource).find((step) => String(step.name || "").includes("Pre-pull"));

    expect(pull.env.AUTH_STATUS).toContain("steps.ghcr-auth.outputs.status");
    expect(pull.run).toContain("ghcr-auth status:");
  });

  test("the credential is removed by an always-running logout before validation", () => {
    const steps = loadSteps(workflowSource);
    const names = steps.map((step) => String(step.name || "").trim());
    const pullIndex = names.findIndex((name) => name.startsWith("Pre-pull"));
    const logoutIndex = names.indexOf("Log out of ghcr.io");
    const validateIndex = names.indexOf("Validate canonical migrations against disposable Supabase Postgres");

    expect(logoutIndex).toBeGreaterThan(pullIndex);
    expect(logoutIndex).toBeLessThan(validateIndex);
    expect(steps[logoutIndex].if).toBe("always()");
    expect(steps[logoutIndex].run).toContain("docker logout ghcr.io");
  });

  test("the approved digest still has exactly one source and no literal copy", () => {
    const resolve = loadSteps(workflowSource).find((step) =>
      String(step.name || "").includes("Resolve the pinned migration image")
    );

    expect(resolve.run).toContain("APPROVED_SUPABASE_IMAGE");
    expect(DIGEST_PATTERN.test(workflowSource)).toBe(false);
  });
});

describe("GHCR authenticated pull negative controls", () => {
  const codesForAuth = (source) => inspectGhcrAuth(source).violations.map((violation) => violation.code);

  const mutations = [
    ["an inherited workflow-level scope block", (s) => s.replace(/\r?\n    permissions:\r?\n      contents: read\r?\n      packages: read\r?\n/, "\n"), "missing-job-permissions"],
    ["packages: write instead of packages: read", (s) => s.replace(/      packages: read\r?\n/, "      packages: write\n"), "missing-packages-read"],
    ["a pull-request scope on the migration job", (s) => s.replace(/      packages: read\r?\n/, "      packages: read\n      pull-requests: write\n"), "job-writes-to-pull-request"],
    ["no authentication step", (s) => s.replace(/- name: Authenticate to ghcr\.io \(best effort\)/, "- name: Skipped authentication"), "missing-auth-step"],
    ["no logout step", (s) => s.replace(/- name: Log out of ghcr\.io/, "- name: Skipped logout"), "missing-logout-step"],
    ["a logout that only runs on success", (s) => s.replace(/- name: Log out of ghcr\.io\r?\n        if: always\(\)\r?\n/, "- name: Log out of ghcr.io\n"), "logout-not-always"],
    ["a fatal authentication step", (s) => s.replace(/\r?\n[ \t]*exit 0\r?\n/, "\n            exit 1\n"), "auth-step-fails-job"],
    ["a token passed on the command line", (s) => s.replace(/--password-stdin/, "--password"), "no-password-stdin"],
    ["a personal access token instead of GITHUB_TOKEN", (s) => s.replace(/secrets\.GITHUB_TOKEN/, "secrets.GHCR_PAT"), "token-not-github-token"],
    ["an unredacted login output", (s) => s.replace(/raw docker login output withheld: pattern redaction is not a guarantee/, "login output follows"), "raw-login-output-not-withheld"],
    ["no anonymous fallback path", (s) => s.replace(/status=anonymous-fallback/g, "status=unknown"), "no-fallback-status"],
    ["no authenticated path", (s) => s.replace(/status=authenticated/g, "status=unknown"), "no-authenticated-status"],
    ["an unreported authentication path", (s) => s.replace(/\r?\n[ \t]*AUTH_STATUS: \$\{\{ steps\.ghcr-auth\.outputs\.status \}\}\r?\n/, "\n"), "pull-not-reporting-auth-path"],
    ["a literal digest", (s) => s.replace(/APPROVED_SUPABASE_IMAGE/, `'ghcr.io/supabase/postgres@sha256:${"b".repeat(64)}'`), "hardcoded-digest"]
  ];

  test.each(mutations)("rejects %s", (_label, mutate, expectedCode) => {
    const mutated = mutate(workflowSource);

    expect(mutated).not.toBe(workflowSource);
    expect(codesForAuth(mutated)).toContain(expectedCode);
  });
});


