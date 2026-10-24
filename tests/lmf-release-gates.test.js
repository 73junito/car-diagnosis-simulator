"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluate, REQUIRED } = require("../scripts/check-lmf-release-gates.cjs");
const baseline = require("../data/lmf/release-evidence.json");
test("release defaults to hold with every mandatory gate pending", () => {
  assert.equal(Object.keys(REQUIRED).length, 8);
  assert.equal(evaluate(baseline).length, 8);
});
test("missing, duplicate or unknown gates fail closed", () => {
  assert.ok(evaluate({ schemaVersion: 1, gates: [] }).length);
  assert.ok(evaluate({...baseline, gates:[...baseline.gates, baseline.gates[0]]}).some(e => e.includes("duplicate")));
});
test("cannot self-attest pass with no proof", () => {
  const gates = baseline.gates.map(g => ({...g, status:"passed"}));
  assert.ok(evaluate({schemaVersion:1,gates}).length >= 8);
});
test("complete evidence permits checklist validation", () => {
  const gates = baseline.gates.map(g => ({...g,status:"passed",commit:"a".repeat(40),evidence:"https://github.com/example/repo/actions/runs/123",reviewer:"independent-reviewer",reviewedAt:"2026-10-24T12:00:00Z"}));
  assert.deepEqual(evaluate({schemaVersion:1,gates}),[]);
});
