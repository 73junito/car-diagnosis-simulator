"use strict";

const fs = require("fs");
const path = require("path");
const { validateArtifact } = require("../scripts/verify-engineering-artifacts");

const root = path.join(__dirname, "..");
const schema = JSON.parse(fs.readFileSync(
  path.join(root, "data", "engineering", "schemas", "engineering-model-artifact.schema.json"),
  "utf8"
));
const artifact = JSON.parse(fs.readFileSync(
  path.join(root, "data", "engineering", "generated", "relay-load-high-resistance.json"),
  "utf8"
));

describe("engineering model artifact contract", () => {
  test("validates the committed relay/load training artifact", () => {
    expect(validateArtifact(artifact, schema)).toEqual([]);
  });

  test("preserves the verified relay/load numeric delta", () => {
    expect(artifact.baseline.value).toBe(1.989);
    expect(artifact.observed.value).toBe(1.593);
    expect(artifact.comparison.delta).toBe(-0.396);
    expect(artifact.comparison.interpretation).toBe("numeric_delta_only");
  });

  test("does not promote a project model to an authoritative specification", () => {
    const invalid = JSON.parse(JSON.stringify(artifact));
    invalid.comparison.authoritativeSpecification = true;
    expect(validateArtifact(invalid, schema)).toContain(
      "training/model-prediction artifacts cannot declare authoritativeSpecification=true"
    );
  });

  test("rejects authoritative reference outcomes for a project-authored training model", () => {
    const invalid = JSON.parse(JSON.stringify(artifact));
    invalid.comparison.status = "within_reference";
    invalid.comparison.interpretation = "authoritative_reference";
    expect(validateArtifact(invalid, schema)).toContain(
      "training/model-prediction artifacts cannot use authoritative reference statuses"
    );
  });

  test("rejects a fabricated delta", () => {
    const invalid = JSON.parse(JSON.stringify(artifact));
    invalid.comparison.delta = -9.999;
    expect(validateArtifact(invalid, schema)).toContain(
      "comparison delta must equal observed.value - baseline.value"
    );
  });
});
