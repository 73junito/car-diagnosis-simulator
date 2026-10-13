'use strict'

const fs = require('fs')
const path = require('path')

const file = path.join(process.cwd(), 'data', 'compliance', 'state-privacy-ai-overlays.json')
const data = JSON.parse(fs.readFileSync(file, 'utf8'))
const errors = []
const assert = (condition, message) => { if (!condition) errors.push(message) }

assert(data.version === 1, 'version must be 1')
assert(data.verified_at === '2026-10-09', 'verified_at must be 2026-10-09')
assert(data.product_posture?.biometric_identification === 'disabled', 'biometric identification must remain disabled')
assert(data.product_posture?.consequential_ai_decisions === 'disabled', 'consequential AI must remain disabled')

const byId = new Map((data.jurisdictions || []).map((item) => [item.id, item]))
for (const id of ['CA', 'IL', 'TX']) assert(byId.has(id), 'missing jurisdiction ' + id)

const ca = byId.get('CA') || {}
assert(ca.dates?.regulations_effective === '2026-01-01', 'CA regulations effective date mismatch')
assert(ca.dates?.significant_decision_admt_compliance === '2027-01-01', 'CA ADMT compliance date mismatch')
assert((ca.controls || []).includes('keep_significant_decision_admt_disabled_until_2027_compliance_controls_are_implemented'),
  'CA significant-decision ADMT must remain disabled')

const il = byId.get('IL') || {}
assert((il.controls || []).includes('before_collection_require_written_release_and_statutory_notice_if_bipa_applies'),
  'IL BIPA written release control required')
assert((il.controls || []).includes('destroy_covered_biometrics_when_initial_purpose_is_satisfied_or_within_three_years_of_last_interaction_whichever_is_first'),
  'IL BIPA destruction control required')

const tx = byId.get('TX') || {}
assert(tx.dates?.traiga_effective === '2026-01-01', 'TX TRAIGA effective date mismatch')
assert((tx.controls || []).includes('before_commercial_biometric_capture_inform_individual_and_obtain_consent'),
  'TX biometric notice/consent control required')
assert((tx.controls || []).includes('do_not_treat_traiga_as_imposing_a_general_private_educational_chatbot_disclosure_duty'),
  'TX TRAIGA disclosure scope must remain accurate')

if (errors.length) {
  console.error('[FAIL] State privacy/AI overlay contract')
  for (const error of errors) console.error('  - ' + error)
  process.exit(1)
}

console.log('[PASS] State privacy/AI overlays verified: California, Illinois, Texas')
