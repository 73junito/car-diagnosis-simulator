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

