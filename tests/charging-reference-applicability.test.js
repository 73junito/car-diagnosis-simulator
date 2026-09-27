"use strict";

const fs = require("fs");
const path = require("path");
const specifications = require("../src/engineering/specifications");
const measurements = require("../src/engineering/measurements");
const comparisons = require("../src/engineering/comparisons");

const root = path.join(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(
  path.join(root, "data", "engineering", "authoritative-specifications", "delco-remy-starting-charging.json"),
  "utf8"
));

function byId(id) {
  return catalog.specifications.find(entry => entry.id === id);
}

function measuredDrop(value, measurementId) {
  return measurements.createMeasuredQuantity({
    quantityType: "voltage_drop",
    unit: "V",
    value,
    labId: "charging-applicability-contract-test",
    measurementId,
    entryMethod: "instructor_entry"
  });
}

describe("charging-system source applicability", () => {
  const leadReference = byId("delco-charging-3wire-number2-lead-max-drop-12v");
  const designReference = byId("delco-charging-cable-new-vehicle-design-drop-12v");

  const exactLeadContext = {
    system: "charging",
    systemVoltage: 12,
    testMethod: "3-wire charging-system cable requirement",
    wiringConfiguration: "3-wire",
    conductor: "#2 lead"
  };

  test("accepts the #2 lead maximum only when all declared source constraints match", () => {
    const evaluation = specifications.evaluateSpecificationApplicability(
      leadReference,
      exactLeadContext
    );
    expect(evaluation.applicable).toBe(true);
    expect(evaluation.reasons).toEqual([]);
  });

  test("rejects missing conductor and wiring context for a constrained reference", () => {
    const evaluation = specifications.evaluateSpecificationApplicability(leadReference, {
      system: "charging",
      systemVoltage: 12,
      testMethod: "3-wire charging-system cable requirement"
    });
    expect(evaluation.applicable).toBe(false);
    expect(evaluation.reasons).toEqual(expect.arrayContaining([
      "wiring configuration context is required by the selected source reference",
      "conductor context is required by the selected source reference"
    ]));
  });

  test("rejects the #2 lead reference for an alternator-ground fault context", () => {
    const evaluation = specifications.evaluateSpecificationApplicability(leadReference, {
      system: "charging",
      systemVoltage: 12,
      testMethod: "3-wire charging-system cable requirement",
      wiringConfiguration: "3-wire",
      conductor: "alternator ground path"
    });
    expect(evaluation.applicable).toBe(false);
    expect(evaluation.reason).toMatch(/conductor does not match/i);

    const result = comparisons.compareMeasuredToReference(
      measuredDrop(0.15, "alternator-ground-drop"),
      leadReference,
      {
        applicable: evaluation.applicable,
        reason: evaluation.reason
      }
    );
    expect(result.status).toBe("not_comparable");
    expect(result.comparable).toBe(false);
  });

  test("applies the 0.200 V #2 lead maximum when the source context matches", () => {
    const evaluation = specifications.evaluateSpecificationApplicability(
      leadReference,
      exactLeadContext
    );
    const within = comparisons.compareMeasuredToReference(
      measuredDrop(0.15, "matched-number2-lead-within"),
      leadReference,
      { applicable: evaluation.applicable, reason: evaluation.reason }
    );
    const exceeds = comparisons.compareMeasuredToReference(
      measuredDrop(0.25, "matched-number2-lead-exceeds"),
      leadReference,
      { applicable: evaluation.applicable, reason: evaluation.reason }
    );

    expect(leadReference.quantity.value).toBe(0.2);
    expect(within.status).toBe("within_reference");
    expect(exceeds.status).toBe("exceeds_reference");
  });

  test("does not apply an otherwise matching charging reference to an open circuit", () => {
    const evaluation = specifications.evaluateSpecificationApplicability(
      leadReference,
      exactLeadContext
    );
    const result = comparisons.compareMeasuredToReference(
      measuredDrop(0, "open-charge-feed-placeholder"),
      leadReference,
      {
        applicable: evaluation.applicable,
        openCircuit: true,
        reason: "Selected charging reference is not applied to an open circuit."
      }
    );

    expect(result.status).toBe("not_comparable");
    expect(result.comparable).toBe(false);
  });

  test("keeps the 0.300 V new-vehicle value as a design-basis reference rather than pass/fail", () => {
    const context = {
      system: "charging",
      systemVoltage: 12,
      testMethod: "charging-cable sizing table"
    };
    const evaluation = specifications.evaluateSpecificationApplicability(
      designReference,
      context
    );
    expect(evaluation.applicable).toBe(true);

    const result = comparisons.compareMeasuredToReference(
      measuredDrop(0.35, "design-basis-example"),
      designReference,
      { applicable: evaluation.applicable, reason: evaluation.reason }
    );

    expect(designReference.comparison).toBe("design_basis");
    expect(designReference.quantity.value).toBe(0.3);
    expect(result.status).toBe("reference_only");
    expect(result.basisRole).toBe("authoritative_specification");
  });
});
