'use strict';

const crypto = require('crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function stableRightsEvidenceHash(evidence) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(evidence))
    .digest('hex');
}

function buildRightsReviewEvidence({ citations, sources, rightsScopes, currentDate }) {
  requireCondition(Array.isArray(citations) && citations.length > 0, 'Persisted citations are required.');
  requireCondition(/^\d{4}-\d{2}-\d{2}$/.test(currentDate || ''), 'A valid currentDate is required.');

  const sourceIds = [...new Set(citations.map((row) => row?.source_id).filter(Boolean))].sort();
  requireCondition(sourceIds.length > 0, 'Persisted citations contain no source identities.');

  const sourceById = new Map((sources || []).map((source) => [source.id, source]));
  const scopeBySourceId = new Map((rightsScopes || []).map((scope) => [scope.source_id, scope]));
  const evidence = [];

  for (const sourceId of sourceIds) {
    const source = sourceById.get(sourceId);
    requireCondition(source, `Rights-reviewed source is missing: ${sourceId}`);
    requireCondition(source.status === 'approved', `Source is not approved: ${sourceId}`);
    requireCondition(source.license && typeof source.license === 'object', `Source license is missing: ${sourceId}`);
    requireCondition(
      source.license.rights_status === 'human_reviewed_approved',
      `Source rights are not human-reviewed approved: ${sourceId}`
    );
    requireCondition(
      source.license.reuse_permission_verified === true,
      `Source reuse permission is not verified: ${sourceId}`
    );
    requireCondition(
      UUID.test(source.license_reviewed_by || '') &&
        typeof source.license_reviewed_at === 'string' &&
        source.license_reviewed_at.length > 0,
      `Source license review evidence is incomplete: ${sourceId}`
    );

    const scope = scopeBySourceId.get(sourceId);
    requireCondition(scope, `Use-specific rights scope is missing: ${sourceId}`);
    requireCondition(
      scope.citation_link_allowed === true &&
        scope.direct_excerpt_allowed === true &&
        scope.database_storage_allowed === true,
      `Use-specific rights scope does not permit mapped citation storage: ${sourceId}`
    );
    requireCondition(
      UUID.test(scope.reviewed_by || '') &&
        typeof scope.reviewed_at === 'string' &&
        scope.reviewed_at.length > 0 &&
        typeof scope.license_evidence_reference === 'string' &&
        scope.license_evidence_reference.trim().length > 0,
      `Use-specific human rights review evidence is incomplete: ${sourceId}`
    );
    requireCondition(
      scope.reviewed_by === source.license_reviewed_by,
      `Rights reviewer identity conflicts with source license review: ${sourceId}`
    );
    requireCondition(
      scope.reviewed_at === source.license_reviewed_at,
      `Rights review timestamp conflicts with source license review: ${sourceId}`
    );
    requireCondition(
      !scope.effective_at || scope.effective_at <= currentDate,
      `Use-specific rights scope is not yet effective: ${sourceId}`
    );
    requireCondition(
      !scope.expires_at || scope.expires_at >= currentDate,
      `Use-specific rights scope has expired: ${sourceId}`
    );

    evidence.push({
      sourceId,
      reviewerIdentity: scope.reviewed_by,
      reviewedAt: scope.reviewed_at,
      licenseEvidenceReference: scope.license_evidence_reference.trim(),
      rightsStatus: source.license.rights_status,
      classification: source.license.classification || null,
      reusePermissionVerified: true,
      citationLinkAllowed: true,
      directExcerptAllowed: true,
      databaseStorageAllowed: true,
      effectiveAt: scope.effective_at || null,
      expiresAt: scope.expires_at || null,
    });
  }

  return {
    evidence,
    evidenceHash: stableRightsEvidenceHash(evidence),
  };
}

function assertRightsReviewInvariants({
  scenarioQuestionCount,
  assessmentEligibilityCount,
  citationValidationCount,
  provenance,
}) {
  requireCondition(
    Number.isInteger(scenarioQuestionCount) && scenarioQuestionCount === 0,
    'Native rights review must not create public scenario_questions rows.'
  );
  requireCondition(
    Number.isInteger(assessmentEligibilityCount) && assessmentEligibilityCount === 0,
    'Native rights review must not create assessment eligibility.'
  );
  requireCondition(
    Number.isInteger(citationValidationCount) && citationValidationCount === 0,
    'Native rights review must not synthesize citation validation.'
  );
  requireCondition(provenance && provenance.status === 'draft', 'Provenance must remain draft during rights review.');
  requireCondition(
    !provenance.technical_reviewer_id &&
      !provenance.technical_reviewed_at &&
      !provenance.instructional_reviewer_id &&
      !provenance.instructional_reviewed_at,
    'Native rights review must not synthesize technical or instructional review.'
  );
  requireCondition(
    !provenance.approved_by && !provenance.approved_at,
    'Native rights review must not synthesize content approval.'
  );
}

module.exports = {
  stableRightsEvidenceHash,
  buildRightsReviewEvidence,
  assertRightsReviewInvariants,
};
