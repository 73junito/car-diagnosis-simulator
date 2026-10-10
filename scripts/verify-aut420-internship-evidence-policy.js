'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

const catalog = read('data/curriculum/course-catalog.json')
const policy = read('data/curriculum/aut420-internship-evidence-policy.json')

function verify() {
  const errors = []
  const course = (catalog.courses || []).find((c) => c.id === 'aut-420')
  const expectedPrerequisite = 'Verified industry employment or approved internship placement required'

  if (!course) errors.push('AUT-420 catalog record missing')
  if (course && course.prerequisites !== expectedPrerequisite) {
    errors.push('AUT-420 catalog prerequisite drift')
  }
  if (policy.courseId !== 'aut-420' || policy.code !== 'AUT 420') {
    errors.push('AUT-420 evidence policy identity drift')
  }
  if (policy.prerequisite !== expectedPrerequisite) {
    errors.push('AUT-420 evidence policy prerequisite drift')
  }
  if (policy.humanReviewRequired !== true) errors.push('humanReviewRequired must remain true')
  if (policy.automaticApprovalAllowed !== false) errors.push('automaticApprovalAllowed must remain false')

  const states = policy.verificationStates || []
  for (const state of ['verified', 'needs-additional-evidence', 'rejected']) {
    if (!states.includes(state)) errors.push(`verification state missing: ${state}`)
  }

  const preferred = (policy.acceptedEvidence?.preferredPrimary || []).map((x) => x.id)
  for (const id of ['employment-verification-letter','signed-internship-agreement','formal-offer-letter']) {
    if (!preferred.includes(id)) errors.push(`preferred primary evidence missing: ${id}`)
  }

  const alternatives = (policy.acceptedEvidence?.acceptableAlternatives || []).map((x) => x.id)
  for (const id of ['onboarding-documentation','employer-confirmation-email','internship-assignment-letter']) {
    if (!alternatives.includes(id)) errors.push(`acceptable alternative missing: ${id}`)
  }

  const supporting = policy.acceptedEvidence?.supportingOnly || []
  for (const label of ['employee ID or company account','pay stub','payroll or direct-deposit documentation']) {
    if (!supporting.includes(label)) errors.push(`supporting-only evidence missing: ${label}`)
  }

  const insufficient = policy.acceptedEvidence?.insufficientAlone || []
  for (const label of [
    'bank deposit without identifiable employer documentation',
    'screenshot without identifiable employer information',
    'informal text message',
    'self-written statement'
  ]) {
    if (!insufficient.includes(label)) errors.push(`insufficient-alone evidence rule missing: ${label}`)
  }

  const minimum = policy.minimumEvidenceElements || []
  for (const label of [
    'student name',
    'employer name',
    'position or role',
    'employment or internship status',
    'start date',
    'employer/supervisor contact or identifiable employer source'
  ]) {
    if (!minimum.includes(label)) errors.push(`minimum evidence element missing: ${label}`)
  }

  const privacy = policy.privacyAndRedaction || {}
  if (privacy.unnecessarySensitivePayrollDataShouldNotBeRequired !== true) {
    errors.push('unnecessarySensitivePayrollDataShouldNotBeRequired must remain true')
  }
  if (privacy.redactionAllowed !== true) errors.push('redactionAllowed must remain true')

  const reviewerFields = policy.reviewerRecord?.requiredFields || []
  for (const field of ['verification state','reviewer','review date','reason or notes']) {
    if (!reviewerFields.includes(field)) errors.push(`reviewer record field missing: ${field}`)
  }

  const separation = policy.decisionSeparation || {}
  if (separation.employmentOrPlacementVerified !== true || separation.internshipApproved !== true) {
    errors.push('employment/placement verification and internship approval must remain separate decisions')
  }

  const boundaries = policy.boundaries || {}
  for (const key of [
    'employmentEvidenceDoesNotAutomaticallyApproveInternship',
    'evidenceUploadDoesNotAuthorizeAssessment',
    'evidenceUploadDoesNotChangeAcademicStatus',
    'noAutomatedEligibilityDecision'
  ]) {
    if (boundaries[key] !== true) errors.push(`policy boundary must remain true: ${key}`)
  }

  return { ok: errors.length === 0, errors }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] AUT-420 internship evidence policy')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] AUT-420 internship evidence policy: employment/placement proof hierarchy, privacy redaction, and human-review boundaries locked')
}

if (require.main === module) main()
module.exports = { verify }
