'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const root = path.resolve(__dirname, '..');

function validateManifest(manifest, fileName, schemaValidate, rootDir = root) {
  const errors = [];
  if (!schemaValidate(manifest)) {
    for (const issue of schemaValidate.errors || []) {
      errors.push(fileName + ': schema ' + (issue.instancePath || '/') + ' ' + issue.message);
    }
    return errors;
  }

  const componentIds = new Set(manifest.components.map((item) => item.id));
  if (componentIds.size !== manifest.components.length) errors.push(fileName + ': component ids must be unique');

  const stepIds = new Set();
  for (const step of manifest.steps) {
    if (stepIds.has(step.id)) errors.push(fileName + ': duplicate step id ' + step.id);
    stepIds.add(step.id);
    for (const componentId of step.componentIds) {
      if (!componentIds.has(componentId)) errors.push(fileName + ': step ' + step.id + ' references unknown component ' + componentId);
    }
  }

  const governance = manifest.governance;
  const evidence = manifest.evidence;
  if (governance.assessmentEligible !== false || governance.scoredAssessmentApproved !== false) {
    errors.push(fileName + ': ANIM-1A artifacts must remain outside assessment eligibility and scored delivery');
  }
  if (governance.agentMayApprove !== false || governance.agentMayRelease !== false) {
    errors.push(fileName + ': agents may prepare animation artifacts but may not approve or release them');
  }
  if (governance.publicationAllowed && (governance.status !== 'final_content_approved' || !governance.humanApprovalRecorded)) {
    errors.push(fileName + ': publication requires final_content_approved plus explicit human approval');
  }
  if (governance.humanApprovalRecorded && governance.status !== 'final_content_approved') {
    errors.push(fileName + ': human approval may only be recorded at final_content_approved');
  }
  if (manifest.classification === 'vehicle-specific') {
    if (!governance.vehicleSpecificClaims) errors.push(fileName + ': vehicle-specific classification must declare vehicleSpecificClaims');
    if (!evidence.required || evidence.approvedEvidenceRefs.length === 0) errors.push(fileName + ': vehicle-specific animation requires approved evidence references');
  } else if (governance.vehicleSpecificClaims) {
    errors.push(fileName + ': non-vehicle-specific animation may not declare vehicle-specific claims');
  }
  if (manifest.classification === 'engineering-derived' && evidence.engineeringArtifactRefs.length === 0) {
    errors.push(fileName + ': engineering-derived animation requires an engineering artifact reference');
  }
  for (const artifactRef of evidence.engineeringArtifactRefs) {
    if (path.isAbsolute(artifactRef) || artifactRef.includes('..')) {
      errors.push(fileName + ': engineering artifact references must be repository-relative');
    } else if (!fs.existsSync(path.join(rootDir, artifactRef))) {
      errors.push(fileName + ': engineering artifact reference does not exist: ' + artifactRef);
    }
  }
  const reviewedStates = ['evidence_mapped','rights_reviewed','technically_reviewed','citation_validated','instructionally_reviewed','final_content_approved'];
  if (reviewedStates.includes(governance.status) && evidence.approvedEvidenceRefs.length === 0 && evidence.engineeringArtifactRefs.length === 0) {
    errors.push(fileName + ': governed review states require bound evidence or engineering artifacts');
  }
  if (manifest.rendering.assetPath && path.isAbsolute(manifest.rendering.assetPath)) errors.push(fileName + ': assetPath must be repository-relative');
  if (manifest.rendering.fallbackImagePath && path.isAbsolute(manifest.rendering.fallbackImagePath)) errors.push(fileName + ': fallbackImagePath must be repository-relative');
  return errors;
}

function validateAll({ rootDir = root } = {}) {
  const schema = JSON.parse(fs.readFileSync(path.join(rootDir, 'schemas', 'animation-manifest.schema.json'), 'utf8'));
  const manifestDirectory = path.join(rootDir, 'animation', 'manifests');
  const ajv = new Ajv({ allErrors: true, strict: false });
  const schemaValidate = ajv.compile(schema);
  const files = fs.readdirSync(manifestDirectory).filter((name) => name.endsWith('.json')).sort();
  const errors = [];
  if (files.length === 0) errors.push('animation/manifests: at least one manifest is required');
  for (const file of files) {
    const manifest = JSON.parse(fs.readFileSync(path.join(manifestDirectory, file), 'utf8'));
    errors.push(...validateManifest(manifest, file, schemaValidate, rootDir));
  }
  return { files, errors };
}

if (require.main === module) {
  const result = validateAll();
  if (result.errors.length) {
    console.error('[FAIL] Governed animation manifest validation failed');
    for (const error of result.errors) console.error('  - ' + error);
    process.exit(1);
  }
  console.log('[PASS] Governed animation manifest validation: ' + result.files.length + ' manifest(s); assessment and human-approval boundaries preserved');
}
module.exports = { validateAll, validateManifest };
