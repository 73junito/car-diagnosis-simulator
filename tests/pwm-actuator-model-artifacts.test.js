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
  path.join(root, "data", "engineering", "generated", "pwm-actuator-short-ground.json"),
  "utf8"
));
const openArtifact = JSON.parse(fs.readFileSync(
  path.join(root, "data", "engineering", "generated", "pwm-actuator-open-command-unavailable.json"),
  "utf8"
));

describe("PWM actuator engineering artifacts", () => {
  test("validates the short-to-ground training artifact", () => {
    expect(validateArtifact(shortArtifact, schema)).toEqual([]);
  });

  test("preserves the 3.600 V avg to 0.000 V avg numeric training delta", () => {
    expect(shortArtifact.baseline.value).toBe(3.6);
    expect(shortArtifact.observed.value).toBe(0);
    expect(shortArtifact.comparison.delta).toBe(-3.6);
    expect(shortArtifact.comparison.interpretation).toBe("numeric_delta_only");
    expect(shortArtifact.comparison.authoritativeSpecification).toBe(false);
  });

  test("validates unavailable open PWM command behavior", () => {
    expect(validateArtifact(openArtifact, schema)).toEqual([]);
    expect(openArtifact.observed).toBeNull();
    expect(openArtifact.comparison.status).toBe("unavailable");
    expect(openArtifact.comparison.interpretation).toBe("not_available");
  });

  test("does not infer actuator response from PWM average", () => {
    expect(shortArtifact.comparison.reason).toMatch(/not a vehicle specification or actuator-response model/i);
    expect(openArtifact.comparison.reason).toMatch(/actuator response is not inferred/i);
  });
});
