"use strict";

const { parseScalar } = require("../engineering/ngspice/run-relay-load-model");

describe("ngspice relay/load adapter", () => {
  test("parses ngspice scalar output in scientific notation", () => {
    const output = "tm_healthy = 1.989000e+00\ntm_fault = 1.592952e+00\n";
    expect(parseScalar(output, "tm_healthy")).toBeCloseTo(1.989, 6);
    expect(parseScalar(output, "tm_fault")).toBeCloseTo(1.592952, 6);
  });

  test("fails closed when an expected scalar is missing", () => {
    expect(() => parseScalar("unrelated output", "tm_healthy")).toThrow(
      "Unable to parse tm_healthy from ngspice output"
    );
  });
});
