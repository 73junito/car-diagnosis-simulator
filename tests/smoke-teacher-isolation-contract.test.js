"use strict";

/**
 * Regression protection for the per-workflow smoke teacher identities.
 *
 * Context: the staging smoke workflows shared one teacher identity
 * (`TEST_TEACHER_EMAIL`). GoTrue revokes **every** session a user holds when
 * its password changes, so a fixture repair performed by one workflow revoked
 * the access token of the sibling workflow that was signed in at that moment.
 * `docs/staging-smoke-concurrency.md` records the resulting `401 Invalid or
 * expired token` failures.
 *
 * The isolation model is:
 *
 * - `smoke.yml` uses `SMOKE_TEACHER_EMAIL` / `SMOKE_TEACHER_PASSWORD`.
 * - `api-smoke.yml` uses `API_SMOKE_TEACHER_EMAIL` /
 *   `API_SMOKE_TEACHER_PASSWORD`.
 * - Both set `SMOKE_TEACHER_ISOLATED: 'true'`, so a run that falls back to the
 *   shared identity refuses to reset its password instead of revoking a
 *   sibling's session.
 * - The release workflow and the production sign-in workflows keep the shared
 *   identity and are deliberately left untouched.
 *
 * These tests read the workflow files structurally, so a commented-out entry
 * cannot satisfy them. No YAML library is declared in package.json, so a
 * dependency-free reader for the YAML subset these files use is provided here.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function readWorkflow(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

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
 * Collect every `key: value` entry declared inside an `env:` block.
 *
 * Job-level and step-level `env:` blocks are both collected, because the
 * smoke credentials may legitimately be declared at either level.
 */
function collectEnvEntries(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let inEnv = false;
  let envIndent = 0;

  for (const raw of lines) {
    const line = stripComment(raw);
    if (!line.trim()) continue;

    const indent = indentOf(line);
    const trimmed = line.trim();

    if (inEnv) {
      if (indent <= envIndent) {
        inEnv = false;
      } else {
        const match = trimmed.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          entries.push({ key: unquote(match[1].trim()), value: unquote(match[2].trim()) });
        }
        continue;
      }
    }

    if (/^env:$/.test(trimmed)) {
      inEnv = true;
      envIndent = indent;
    }
  }

  return entries;
}

function envValue(entries, key) {
  const match = entries.find((entry) => entry.key === key);
  return match ? match.value : undefined;
}

describe("smoke teacher identity isolation contract", () => {
  const smokeWorkflow = readWorkflow(".github/workflows/smoke.yml");
  const apiSmokeWorkflow = readWorkflow(".github/workflows/api-smoke.yml");
  const releaseWorkflow = readWorkflow(".github/workflows/release.yml");
  const curriculumProductionWorkflow = readWorkflow(
    ".github/workflows/curriculum-evidence-production-e2e.yml"
  );
  const semanticScholarProductionWorkflow = readWorkflow(
    ".github/workflows/semantic-scholar-production-smoke.yml"
  );

  const smokeEnv = collectEnvEntries(smokeWorkflow);
  const apiSmokeEnv = collectEnvEntries(apiSmokeWorkflow);

  test("each staging smoke workflow declares its own dedicated teacher identity", () => {
    expect(envValue(smokeEnv, "DEDICATED_TEACHER_EMAIL")).toBe("${{ secrets.SMOKE_TEACHER_EMAIL }}");
    expect(envValue(smokeEnv, "DEDICATED_TEACHER_PASSWORD")).toBe("${{ secrets.SMOKE_TEACHER_PASSWORD }}");
    expect(envValue(apiSmokeEnv, "DEDICATED_TEACHER_EMAIL")).toBe("${{ secrets.API_SMOKE_TEACHER_EMAIL }}");
    expect(envValue(apiSmokeEnv, "DEDICATED_TEACHER_PASSWORD")).toBe(
      "${{ secrets.API_SMOKE_TEACHER_PASSWORD }}"
    );
  });

  test("the two staging smoke workflows never share one dedicated secret", () => {
    expect(envValue(smokeEnv, "DEDICATED_TEACHER_EMAIL")).not.toBe(
      envValue(apiSmokeEnv, "DEDICATED_TEACHER_EMAIL")
    );
    expect(envValue(smokeEnv, "DEDICATED_TEACHER_PASSWORD")).not.toBe(
      envValue(apiSmokeEnv, "DEDICATED_TEACHER_PASSWORD")
    );
  });

  test("both staging smoke workflows refuse to reset the shared identity password", () => {
    expect(envValue(smokeEnv, "SMOKE_TEACHER_ISOLATED")).toBe("true");
    expect(envValue(apiSmokeEnv, "SMOKE_TEACHER_ISOLATED")).toBe("true");
  });

  test("the release and production workflows keep the shared identity untouched", () => {
    for (const [name, workflow] of [
      ["release.yml", releaseWorkflow],
      ["curriculum-evidence-production-e2e.yml", curriculumProductionWorkflow],
      ["semantic-scholar-production-smoke.yml", semanticScholarProductionWorkflow]
    ]) {
      const env = collectEnvEntries(workflow);
      expect(`${name}:${String(envValue(env, "DEDICATED_TEACHER_EMAIL"))}`).toBe(`${name}:undefined`);
      expect(`${name}:${String(envValue(env, "DEDICATED_TEACHER_PASSWORD"))}`).toBe(
        `${name}:undefined`
      );
      expect(`${name}:${String(envValue(env, "SMOKE_TEACHER_ISOLATED"))}`).toBe(`${name}:undefined`);
    }
  });

  test("the smoke script reads the dedicated credentials and the isolation opt-in", () => {
    const script = readWorkflow("torquemind-api/scripts/smoke-test.js");

    expect(script).toContain("DEDICATED_TEACHER_EMAIL");
    expect(script).toContain("DEDICATED_TEACHER_PASSWORD");
    expect(script).toContain("SMOKE_TEACHER_ISOLATED");
    expect(script).toContain("function resolveTeacherCredentials(");
    expect(script).toContain("TEACHER_SCOPE_SHARED_ISOLATED");
    expect(script).toContain("allowPasswordReset");
  });

  test("the provisioning helper is operator-only and staging-only", () => {
    const script = readWorkflow("torquemind-api/scripts/provision-smoke-teacher-identity.js");

    expect(script).toContain("Refusing to run inside CI");
    expect(script).toContain("jchfruprqpeypdttvlam.supabase.co");
    expect(script).toContain("Refusing to provision the shared teacher identity");
  });

  test("the environment reader reports the isolation opt-in faithfully", () => {
    // Negative control for the reader: a commented-out entry must not be
    // reported as a declared environment variable.
    const sample = [
      "jobs:",
      "  smoke:",
      "    env:",
      "      # SMOKE_TEACHER_ISOLATED: 'true'",
      "      BASE_URL: http://localhost:3000"
    ].join("\n");

    const env = collectEnvEntries(sample);
    expect(String(envValue(env, "SMOKE_TEACHER_ISOLATED"))).toBe("undefined");
    expect(envValue(env, "BASE_URL")).toBe("http://localhost:3000");
  });
});
