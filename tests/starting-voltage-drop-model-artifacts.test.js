"use strict";

const fs = require("fs");
const path = require("path");
const { validateArtifact } = require("../scripts/verify-engineering-artifacts");
const specifications = require("../src/engineering/specifications");
const measurements = require("../src/engineering/measurements");
const comparisons = require("../src/engineering/comparisons");

const root = path.join(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

const schema = readJson("data/engineering/schemas/engineering-model-artifact.schema.json");
const withinArtifact = readJson("data/engineering/generated/starting-cable-drop-within-candidate.json");
const exceedsArtifact = readJson("data/engineering/generated/starting-cable-drop-exceeds-candidate.json");
const openArtifact = readJson("data/engineering/generated/starting-cable-open-unavailable.json");
const sourceCatalog = readJson("data/engineering/authoritative-specifications/delco-remy-starting-charging.json");

function modeledReading(artifact, measurementId) {
  return measurements.createMeasuredQuantity({
    quantityType: artifact.quantity.quantityType,
    unit: artifact.quantity.unit,
    value: artifact.observed.value,
    labId: "starting-system-model-contract-test",
    measurementId,
    entryMethod: "instructor_entry",
    note: "Test-only simulated reading derived from a project-authored model artifact."
  });
}

describe("starting-system voltage-drop model and source comparison", () => {
  const reference = specifications.selectMostSpecificSpecification(sourceCatalog, {
    system: "starting",
    systemVoltage: 12,
    starterFamily: "50MT",
    parameter: "starter_cable_total_voltage_drop"
  });

  test("keeps model artifacts non-authoritative", () => {
    expect(validateArtifact(withinArtifact, schema)).toEqual([]);
    expect(validateArtifact(exceedsArtifact, schema)).toEqual([]);
    expect(withinArtifact.evidenceRole).toBe("project_authored_training_model");
    expect(withinArtifact.comparison.interpretation).toBe("numeric_delta_only");
    expect(withinArtifact.comparison.authoritativeSpecification).toBe(false);
  });

  test("selects the existing source-backed 0.400 V maximum for the 12 V 50MT case", () => {
    expect(reference).not.toBeNull();
    expect(reference.quantity.valueRole).toBe("authoritative_specification");
    expect(reference.quantity.quantityType).toBe("voltage_drop");
    expect(reference.quantity.unit).toBe("V");
    expect(reference.quantity.value).toBe(0.4);
    expect(reference.comparison).toBe("maximum");
  });

  test("classifies the 0.350 V modeled scenario as within the selected source reference", () => {
    const result = comparisons.compareMeasuredToReference(
      modeledReading(withinArtifact, "modeled-0p350V"),
      reference
    );
    expect(result.status).toBe("within_reference");
    expect(result.basisRole).toBe("authoritative_specification");
    expect(result.difference).toBeCloseTo(-0.05, 9);
  });

  test("classifies the 0.450 V modeled scenario as exceeding the selected source reference", () => {
    const result = comparisons.compareMeasuredToReference(
      modeledReading(exceedsArtifact, "modeled-0p450V"),
      reference
    );
    expect(result.status).toBe("exceeds_reference");
    expect(result.basisRole).toBe("authoritative_specification");
    expect(result.difference).toBeCloseTo(0.05, 9);
  });

  test("keeps an open circuit unavailable and not comparable to the source limit", () => {
    expect(validateArtifact(openArtifact, schema)).toEqual([]);
    expect(openArtifact.observed).toBeNull();
    expect(openArtifact.comparison.status).toBe("unavailable");

    const placeholder = measurements.createMeasuredQuantity({
      quantityType: "voltage_drop",
      unit: "V",
      value: 0,
      labId: "starting-system-model-contract-test",
      measurementId: "open-circuit-placeholder",
      entryMethod: "instructor_entry"
    });

    const result = comparisons.compareMeasuredToReference(placeholder, reference, {
      openCircuit: true,
      reason: "Selected source comparison is not applied to an open circuit."
    });

    expect(result.status).toBe("not_comparable");
    expect(result.comparable).toBe(false);
  });
});
