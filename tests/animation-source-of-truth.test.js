/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '..')
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
const exists = (relative) => fs.existsSync(path.join(root, relative))

describe('ANIM-2A student-lab animation source-of-truth contract', () => {
  const registry = readJson('data/architecture/student-lab-animation-source-of-truth.json')

  test('declares the governed manifest/player/runtime stack as authoritative', () => {
    expect(registry.phase).toBe('ANIM-2A')
    expect(registry.status).toBe('active-source-of-truth')
    expect(registry.source_of_truth.renderer).toBe('three-js')
    expect(registry.source_of_truth.policy).toMatch(/governed animation manifest\/player\/runtime stack/i)
    expect(exists(registry.source_of_truth.manifest_schema)).toBe(true)
    expect(exists(registry.source_of_truth.player_module)).toBe(true)
    expect(exists(registry.source_of_truth.runtime_module)).toBe(true)
    expect(exists(registry.source_of_truth.player_styles)).toBe(true)
    expect(registry.source_of_truth.manifest_schema_target).toBe('1.1.0')
    expect(registry.source_of_truth.presentation_contract).toBe('data/architecture/animation-presentation-contract.json')
    expect(registry.source_of_truth.presentation_validator).toBe('scripts/verify-animation-presentation-contract.js')
    expect(exists(registry.source_of_truth.presentation_contract)).toBe(true)
    expect(exists(registry.source_of_truth.presentation_validator)).toBe(true)
  })

  test('keeps publication and assessment fail-closed', () => {
    expect(registry.global_invariants.default_policy).toBe('deny')
    expect(registry.global_invariants.human_approval_required_for_publication).toBe(true)
    expect(registry.global_invariants.agent_may_approve).toBe(false)
    expect(registry.global_invariants.agent_may_release).toBe(false)
    expect(registry.global_invariants.assessment_eligible).toBe(false)
    expect(registry.global_invariants.scored_assessment_approved).toBe(false)
  })

  test('makes Starting System the first governed integration without publishing it', () => {
    const integration = registry.lab_integrations.find((item) => item.lab_id === 'starting-system-lab')
    expect(integration).toBeDefined()
    expect(integration.status).toBe('contract-migrated-awaiting-motion-generation-and-human-publication-approval')
    expect(integration.manifest_schema_version).toBe('1.1.0')
    expect(integration.presentation_contract_version).toBe('1.0.0')
    expect(exists(integration.surface)).toBe(true)
    expect(exists(integration.production_manifest)).toBe(true)
    expect(exists(integration.review_manifest)).toBe(true)
    expect(exists(integration.engineering_source)).toBe(true)
    expect(integration.legacy_visualization.authoritative_animation_source).toBe(false)

    const foundation = readJson(integration.production_manifest)
    const review = readJson(integration.review_manifest)
    for (const manifest of [foundation, review]) {
      expect(manifest.governance.humanApprovalRecorded).toBe(false)
      expect(manifest.governance.publicationAllowed).toBe(false)
      expect(manifest.governance.assessmentEligible).toBe(false)
      expect(manifest.governance.scoredAssessmentApproved).toBe(false)
      expect(manifest.governance.agentMayApprove).toBe(false)
      expect(manifest.governance.agentMayRelease).toBe(false)
    }
  })

  test('treats all remaining core labs as migration targets, not parallel animation authorities', () => {
    expect(registry.migration_queue).toEqual([
      'circuit-lab',
      'relay-load-lab',
      'sensor-lab',
      'actuator-lab',
      'network-lab',
      'multivoltage-lab',
    ])
  })
})
