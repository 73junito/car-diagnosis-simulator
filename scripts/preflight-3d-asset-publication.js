"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const { evaluatePublication } = require("./check-3d-publication-gate");

const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const hex = x => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
const deny = reasons => ({ decision: "blocked", publishAuthorized: false, reasons });

/**
 * Fail-closed, local preflight. Only integrity is verified cryptographically.
 * Review records are *not* authenticated by this script.
 */
function preflight({ register, manifest, request, authorization, assetBytes,
                     expectedAssetDigest, trustedApproval } = {}) {
  const reasons = [];
  if (!Buffer.isBuffer(assetBytes) || !assetBytes.length)
    reasons.push("nonempty asset bytes required");
  if (!hex(expectedAssetDigest) || !hex(authorization?.assetSha256) ||
      expectedAssetDigest !== authorization?.assetSha256)
    reasons.push("exact approved asset digest binding required");
  if (Buffer.isBuffer(assetBytes) && assetBytes.length && hex(expectedAssetDigest) &&
      digest(assetBytes) !== expectedAssetDigest)
    reasons.push("asset content does not match approved digest");
  // Explicit external trust signal: must be supplied by a separately authenticated,
  // protected promotion system; never read this value from the manifest/authorization.
  if (trustedApproval !== true) reasons.push("trusted approval authentication required");
  const governance = evaluatePublication({ register, manifest, request, authorization });
  if (!governance.publishAuthorized) reasons.push(...governance.reasons);
  return reasons.length ? deny(reasons) :
    { decision: "approved", publishAuthorized: true, assetSha256: expectedAssetDigest,
      reasons: ["approved asset digest and governance checks match; trust asserted by caller"] };
}
function main() {
  // Intentionally NO CLI option to assert trustedApproval. Local invocation
  // is always fail-closed until a separate authenticated caller is implemented.
  const [registerFile, manifestFile, requestFile, authFile, assetFile] = process.argv.slice(2);
  if ([registerFile, manifestFile, requestFile, authFile, assetFile].some(x => !x))
    throw Error("Usage: node scripts/preflight-3d-asset-publication.js register.json manifest.json request.json authorization.json model.glb");
  const load = file => JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  const bytes = fs.readFileSync(path.resolve(assetFile));
  const authorization = load(authFile);
  const result = preflight({ register: load(registerFile), manifest: load(manifestFile),
    request: load(requestFile), authorization, assetBytes: bytes,
    expectedAssetDigest: authorization.assetSha256, trustedApproval: false });
  console.log(JSON.stringify(result, null, 2));
  if (!result.publishAuthorized) process.exitCode = 1;
}
if (require.main === module) try { main(); } catch (error) {
  console.error(error.message); process.exitCode = 1;
}
module.exports = { digest, preflight };
