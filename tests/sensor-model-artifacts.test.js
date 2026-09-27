"use strict";

const fs = require("fs");
const path = require("path");
const { validateArtifact } = require("../scripts/verify-engineering-artifacts");

const root = path.join(__dirname, "..");
const schema = JSON.parse(fs.readFileSync(
  path.join(root, "data", "engineering", "schemas", "engineering-model-artifact.schema.json"),
  "utf8"
));
const shortArtifact = JSON.parse(fs.readFileSync(
  path.join(root, "data", "engineering", "generated", "sensor-signal-short-ground.json"),
  "utf8"
));
const unavailableArtifact = JSON.parse(fs.readFileSync(
  path.join(root, "data", "engineering", "generated", "sensor-ground-high-resistance-unavailable.json"),
  "utf8"
));

describe("sensor engineering artifacts", () => {
  test("validates the short-to-ground training artifact", () => {
    expect(validateArtifact(shortArtifact, schema)).toEqual([]);
  });

  test("preserves the 2.500 V to 0.000 V numeric training delta", () => {
    expect(shortArtifact.baseline.value).toBe(2.5);
    expect(shortArtifact.observed.value).toBe(0);
    expect(shortArtifact.comparison.delta).toBe(-2.5);
    expect(shortArtifact.comparison.interpretation).toBe("numeric_delta_only");
    expect(shortArtifact.comparison.authoritativeSpecification).toBe(false);
  });

  test("validates unavailable high-resistance sensor-ground behavior", () => {
    expect(validateArtifact(unavailableArtifact, schema)).toEqual([]);
    expect(unavailableArtifact.observed).toBeNull();
    expect(unavailableArtifact.comparison.status).toBe("unavailable");
    expect(unavailableArtifact.comparison.interpretation).toBe("not_available");
  });

  test("does not infer a degraded-ground voltage", () => {
    expect(unavailableArtifact.comparison.reason).toMatch(/intentionally not inferred/i);
  });
});
