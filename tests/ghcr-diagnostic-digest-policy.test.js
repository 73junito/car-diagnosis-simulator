"use strict";

/*
 * Regression contract for the GHCR diagnostic workflow's image-reference guard.
 *
 * The repository digest-policy validator treats every non-comment line containing
 * the Supabase image marker as an image reference and requires the pinned digest on
 * that line. The diagnostic needs a grep pattern for that reference, which is not a
 * reference itself but reads like one. Written as a single literal, the pattern
 * tripped the policy and failed the full test suite on every pull request tested
 * against main.
 *
 * The guard therefore assembles the pattern from parts, and the workflow carries no
 * image digest of its own: it reads the reference from the workflow that actually
 * consumes it and cross-checks the harness export. This file locks that in.
 */

const fs = require("fs");
const path = require("path");

const workflowPath = path.join(__dirname, "..", ".github", "workflows", "ghcr-auth-diagnostic.yml");
const source = fs.readFileSync(workflowPath, "utf8");

/** The marker and digest the repository digest policy enforces. */
const SUPABASE_IMAGE_MARKER = "supabase/postgres";
const APPROVED_SUPABASE_IMAGE_DIGEST =
  "sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb";

function nonCommentLines(text) {
  return text.split(/\r?\n/).filter((line) => !/^\s*#/.test(line));
}

describe("GHCR diagnostic: repository digest-policy compatibility", () => {
  test("no non-comment line carries the image marker without the pinned digest", () => {
    // This is the policy rule, restated so a regression fails here rather than in
    // the full test suite of every pull request merged with main.
    const offending = nonCommentLines(source).filter(
      (line) => line.includes(SUPABASE_IMAGE_MARKER) && !line.includes(APPROVED_SUPABASE_IMAGE_DIGEST)
    );

    expect(offending).toEqual([]);
  });

  test("the guard assembles its pattern instead of embedding the marker in one literal", () => {
    expect(source).toContain("registry='ghcr\\.io'");
    expect(source).toContain("namespace='supabase'");
    expect(source).toContain("name='postgres'");
    expect(source).toContain('pattern="${registry}/${namespace}/${name}:[0-9a-z.]+@sha256:[0-9a-f]{64}"');
    expect(source).toContain('refs=$(grep -Eo "$pattern" "$consumer" | sort -u || true)');
  });

  test("the assembled pattern is still repository-specific", () => {
    // Assembling the parts must not broaden the match to any ghcr.io image.
    expect(source).not.toContain("ghcr\\.io/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+");
    expect(source).toContain("registry='ghcr\\.io'");
    expect(source).toContain("namespace='supabase'");
    expect(source).toContain("name='postgres'");
  });

  test("the exactly-one-reference guard is preserved", () => {
    expect(source).toContain("count=$(printf '%s' \"$refs\" | grep -c '^ghcr\\.io/' || true)");
    expect(source).toContain('if [ "$count" -eq 0 ]; then');
    expect(source).toContain('if [ "$count" -gt 1 ]; then');
    expect(source).toContain("BLOCKED: no approved image reference found in $consumer.");
    expect(source).toContain("exactly one is required.");
    expect(source).toContain('exit 1');
  });

  test("the workflow embeds no image digest of its own", () => {
    // One source of truth: the consumer workflow, which the digest policy pins,
    // cross-checked against the harness export. A second copy here could drift.
    expect(source).not.toMatch(/sha256:[0-9a-f]{64}/);
    expect(source).toContain("scripts/lib/disposable-migration-container");
    expect(source).toContain("digest drift between $consumer and the harness export");
  });
});
