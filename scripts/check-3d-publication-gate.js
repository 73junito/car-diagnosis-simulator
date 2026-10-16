"use strict";
const fs = require("node:fs");
const { decide } = require("./validate-component-reuse");

const nonempty = x => typeof x === "string" && x.trim().length > 0;
const deny = reasons => ({ decision: "blocked", publishAuthorized: false, reasons });
/**
 * Pre-publication authorization decision. This is an offline governance contract,
 * not a runtime bypass or a production publishing endpoint.
 * Human signoffs must come from trusted review records; this script validates their
 * shape and bindings but cannot authenticate reviewer identity.
 */
function evaluatePublication({ register, manifest, request, authorization } = {}) {
  const reasons = [];
  if (!register || register.schemaVersion !== "1.0.0" ||
      !Array.isArray(register.sources) || !Array.isArray(register.assetReviews))
    return deny(["engineering evidence register missing or invalid"]);
  if (!manifest || !request || !authorization ||
      !nonempty(manifest.assetId) || !nonempty(request.application))
    return deny(["manifest, request and publication authorization required"]);

  // No assessment, safety, manufacturing or software simulation authority implied.
  if (request.use !== "visual" && request.use !== "geometry")
    return deny(["publication gate supports visual or geometry use only"]);

  const reuse = decide(manifest, request);
  if (reuse.decision !== "approved")
    reasons.push("component reuse not approved: " + reuse.reasons.join("; "));

  const review = register.assetReviews.find(x => x.id === manifest.assetId);
  if (!review) reasons.push("asset has no matching engineering evidence review");
  else {
    if (!Array.isArray(review.sourceIds) || !review.sourceIds.length ||
        !review.sourceIds.every(id => register.sources.some(s => s.id === id)))
      reasons.push("source references missing from evidence register");
    if (review.status !== "approved" || !nonempty(review.technicalReviewer) ||
        !nonempty(review.reviewEvidence))
      reasons.push("independent engineering asset review not approved");
    if (Array.isArray(review.geometryGaps) && review.geometryGaps.length)
      reasons.push("outstanding geometry gaps require resolution");
  }

  if (authorization.assetId !== manifest.assetId ||
      authorization.assetRevision !== manifest.revision ||
      authorization.application !== request.application ||
      authorization.use !== request.use ||
      authorization.status !== "approved" ||
      !nonempty(authorization.reviewer) ||
      !nonempty(authorization.evidence) ||
      !nonempty(authorization.reviewedAt))
    reasons.push("explicit revision- and application-bound publication signoff required");
  if (authorization.reviewer && review?.technicalReviewer &&
      authorization.reviewer === review.technicalReviewer)
    reasons.push("publication reviewer must be independent of technical reviewer");
  if (authorization.rightsStatus !== "cleared")
    reasons.push("redistribution/license permissions not cleared");
  if (authorization.accessibilityStatus !== "passed" ||
      authorization.performanceStatus !== "passed")
    reasons.push("accessibility and performance review required");
  return reasons.length ? deny(reasons) :
    { decision: "approved", publishAuthorized: true,
      reasons: ["reuse, source, technical review and independent publication approval match"] };
}
function main() {
  const [registerFile, manifestFile, requestFile, authorizationFile] = process.argv.slice(2);
  if (![registerFile, manifestFile, requestFile, authorizationFile].every(nonempty))
    throw Error("Usage: node scripts/check-3d-publication-gate.js register.json manifest.json request.json authorization.json");
  const load = f => JSON.parse(fs.readFileSync(f, "utf8"));
  const result = evaluatePublication({ register: load(registerFile), manifest: load(manifestFile),
    request: load(requestFile), authorization: load(authorizationFile) });
  console.log(JSON.stringify(result, null, 2));
  if (!result.publishAuthorized) process.exitCode = 1;
}
if (require.main === module) try { main(); } catch (e) {
  console.error(e.message); process.exitCode = 1;
}
module.exports = { evaluatePublication };
