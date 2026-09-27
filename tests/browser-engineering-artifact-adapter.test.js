"use strict";

const artifacts = require("../src/engineering/artifacts");

const registry = {
  registryRole: "browser-engineering-artifacts",
  entries: [
    {
      key: "sensor.short-ground.nominal50",
      path: "/data/engineering/generated/sensor-signal-short-ground.json",
      context: { normalizedInputPercent: 50 },
      expected: {
        artifactId: "sensor-signal-short-ground-v1",
        evidenceRole: "project_authored_training_model",
        quantityType: "voltage",
        unit: "V",
        authoritativeSpecification: false
      }
    }
  ]
};

const artifact = {
  artifactId: "sensor-signal-short-ground-v1",
  modelId: "sensor-linear-transfer-short-ground-training-model",
  evidenceRole: "project_authored_training_model",
  quantity: { quantityType: "voltage", unit: "V" },
  baseline: { value: 2.5, label: "healthy modeled signal" },
  observed: { value: 0, label: "signal short-to-ground model" },
  comparison: {
    status: "changed",
    delta: -2.5,
    interpretation: "numeric_delta_only",
    authoritativeSpecification: false
  }
};

function mockFetch(expectedUrl, body) {
  return async (url) => ({
    ok: url === expectedUrl,
    async json() {
      return body;
    }
  });
}

describe("browser engineering artifact adapter", () => {
  test("matches exact registered context", () => {
    expect(artifacts.contextMatches(
      registry.entries[0],
      { normalizedInputPercent: 50 }
    )).toBe(true);
    expect(artifacts.contextMatches(
      registry.entries[0],
      { normalizedInputPercent: 60 }
    )).toBe(false);
  });
  test("resolves and validates a registered artifact", async () => {
    const result = await artifacts.resolveArtifact(
      registry,
      "sensor.short-ground.nominal50",
      { normalizedInputPercent: 50 },
      mockFetch(registry.entries[0].path, artifact)
    );
    expect(result.status).toBe("ready");
    expect(result.artifact.artifactId).toBe("sensor-signal-short-ground-v1");
  });

  test("refuses a registered artifact outside its fixed model context", async () => {
    const result = await artifacts.resolveArtifact(
      registry,
      "sensor.short-ground.nominal50",
      { normalizedInputPercent: 49 },
      mockFetch(registry.entries[0].path, artifact)
    );
    expect(result.status).toBe("not_applicable");
  });

  test("fails closed when artifact authority metadata changes", () => {
    const promoted = {
      ...artifact,
      comparison: { ...artifact.comparison, authoritativeSpecification: true }
    };
    expect(artifacts.validateArtifactForEntry(promoted, registry.entries[0]))
      .toContain("authoritativeSpecification does not match registry");
  });
  test("converts artifact baseline and observed values into training quantities", () => {
    const baseline = artifacts.quantityFromArtifact(artifact, "baseline");
    const observed = artifacts.quantityFromArtifact(artifact, "observed");

    expect(baseline).toMatchObject({
      quantityType: "voltage",
      unit: "V",
      valueRole: "generic_training_example",
      value: 2.5
    });
    expect(observed.value).toBe(0);
    expect(observed.artifact.artifactId).toBe("sensor-signal-short-ground-v1");
  });

  test("compares a project-authored scenario to an authoritative reference without changing evidence roles", () => {
    const startingArtifact = {
      ...artifact,
      artifactId: "starting-cable-drop-within-candidate-v1",
      evidenceRole: "project_authored_training_model",
      quantity: { quantityType: "voltage_drop", unit: "V" },
      observed: { value: 0.35 },
      comparison: { status:"changed", interpretation:"numeric_delta_only", authoritativeSpecification:false }
    };
    const reference = {
      comparison: "maximum",
      applicability: { systemVoltage: 12 },
      quantity: {
        quantityType: "voltage_drop",
        unit: "V",
        valueRole: "authoritative_specification",
        value: 0.4,
        source: { id:"source-record", locator:"test locator" }
      }
    };
    const result = artifacts.compareObservedToAuthoritativeReference(
      startingArtifact,
      reference,
      { nominalVoltage:12, applicable:true }
    );
    expect(result.status).toBe("within_reference");
    expect(result.scenarioRole).toBe("project_authored_training_model");
    expect(result.basisRole).toBe("authoritative_specification");
  });

  test("keeps unavailable observed artifacts non-comparable", () => {
    const openArtifact = {
      ...artifact,
      artifactId: "starting-cable-open-unavailable-v1",
      quantity: { quantityType:"voltage_drop", unit:"V" },
      observed: null,
      comparison: { status:"unavailable", interpretation:"not_available", authoritativeSpecification:false }
    };
    const reference = {
      comparison:"maximum",
      applicability:{systemVoltage:12},
      quantity:{
        quantityType:"voltage_drop",unit:"V",valueRole:"authoritative_specification",value:0.4,
        source:{id:"source-record",locator:"test locator"}
      }
    };
    expect(artifacts.compareObservedToAuthoritativeReference(openArtifact, reference, {nominalVoltage:12}).status)
      .toBe("not_comparable");
  });
});
