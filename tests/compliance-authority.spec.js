"use strict";

const fs = require("fs");
const path = require("path");

const registry = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/compliance/authority-registry.json"), "utf8")
);

describe("compliance authority governance", () => {
  test("AI remains the lowest authority", () => {
    expect(registry.authorityOrder.at(-1)).toBe("ai-explanation");
    expect(registry.rules.ai_is_never_source_of_truth).toBe(true);
  });

  test("regulatory law is separated from technical standards", () => {
    const federal = registry.authorities.find((item) => item.authorityId === "us-federal-fmvss-305a");
    const iso = registry.authorities.find((item) => item.authorityId === "iso-16750-2-2023");

    expect(federal.authorityType).toBe("federal-regulation");
    expect(federal.bindingStatus).toBe("binding-when-applicable");
    expect(iso.authorityType).toBe("non-incorporated-standard");
    expect(iso.bindingStatus).toBe("standard-not-automatically-law");
    expect(iso.incorporatedByReference).toBe(false);
  });

  test("Kansas state overlay is not misrepresented as an electrical design specification", () => {
    const kansas = registry.authorities.find((item) => item.authorityId === "ks-kcpa-50-623-et-seq");
    expect(kansas.authorityType).toBe("state-law-or-regulation");
    expect(kansas.scope).toMatch(/not an electrical circuit design specification/i);
  });

  test("seeded authority text is not approved for model ingestion", () => {
    for (const authority of registry.authorities) {
      expect(authority.fullTextIngestionAllowed).toBe(false);
    }
  });

  test("vehicle-specific claims require authoritative vehicle information", () => {
    expect(registry.rules.vehicle_specific_claims_require_authoritative_vehicle_source).toBe(true);
  });
});
