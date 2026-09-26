"use strict";

const REQUIRED_PROVENANCE_FIELDS = Object.freeze([
  "source_id",
  "source_type",
  "canonical_url",
  "publisher",
  "retrieved_at",
  "rights_status",
  "artifact_sha256",
  "chunk_id",
  "claim_id",
  "review_status",
]);

function validateProvenance(record = {}) {
  const missing = REQUIRED_PROVENANCE_FIELDS.filter((field) => {
    const value = record[field];
    return typeof value !== "string" || !value.trim();
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

module.exports = {
  REQUIRED_PROVENANCE_FIELDS,
  validateProvenance,
};
