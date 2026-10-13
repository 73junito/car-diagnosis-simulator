const fs = require('fs')
const os = require('os')
const path = require('path')
const { validateAll } = require('../scripts/verify-animation-manifests')

const root = path.resolve(__dirname, '..')
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'animation-manifest.schema.json'), 'utf8'))
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'animation', 'manifests', 'starting-system-voltage-drop-foundation.json'), 'utf8'))
const architecture = JSON.parse(fs.readFileSync(path.join(root, 'data', 'architecture', 'animation-governance-foundation.json'), 'utf8'))

function withManifest(mutator) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anim-manifest-'))
  fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'animation', 'manifests'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'data', 'circuit-templates'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'schemas', 'animation-manifest.schema.json'), JSON.stringify(schema))
  fs.writeFileSync(path.join(dir, 'data', 'circuit-templates', '12v-starting-system.json'), '{}')
  const copy = JSON.parse(JSON.stringify(manifest))
  mutator(copy)
  fs.writeFileSync(path.join(dir, 'animation', 'manifests', 'candidate.json'), JSON.stringify(copy))
  return { dir, result: validateAll({ rootDir: dir }) }
}

describe('ANIM-1A governed animation foundation', () => {
  test('validates the canonical draft manifest', () => {
    const result = validateAll()
    expect(result.files).toContain('starting-system-voltage-drop-foundation.json')
    expect(result.errors).toEqual([])
  })

  test('keeps ANIM-1A outside assessment and scored-delivery eligibility', () => {
    expect(manifest.governance.assessmentEligible).toBe(false)
    expect(manifest.governance.scoredAssessmentApproved).toBe(false)
  })

  test('forbids agent approval and release authority', () => {
    expect(manifest.governance.agentMayApprove).toBe(false)
    expect(manifest.governance.agentMayRelease).toBe(false)
  })

  test('fails closed when publication is claimed before explicit final human approval', () => {
    const { dir, result } = withManifest((candidate) => { candidate.governance.publicationAllowed = true })
    try { expect(result.errors.join('\n')).toMatch(/publication requires/) }
    finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })

  test('requires approved evidence for vehicle-specific animation claims', () => {
    const { dir, result } = withManifest((candidate) => {
      candidate.classification = 'vehicle-specific'
      candidate.governance.vehicleSpecificClaims = true
      candidate.evidence.approvedEvidenceRefs = []
    })
    try { expect(result.errors.join('\n')).toMatch(/vehicle-specific animation requires approved evidence/) }
    finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })

  test('requires engineering provenance for engineering-derived animations', () => {
    const { dir, result } = withManifest((candidate) => { candidate.evidence.engineeringArtifactRefs = [] })
    try { expect(result.errors.join('\n')).toMatch(/engineering-derived animation requires/) }
    finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })

  test('requires accessible runtime obligations in the schema', () => {
    expect(manifest.accessibility).toEqual({ keyboardOperable: true, reducedMotionRequired: true, staticFallbackRequired: true, textAlternativeRequired: true })
  })

  test('defines a default-deny agentic animation architecture with human-only approval gates', () => {
    expect(architecture.phase).toBe('ANIM-1A')
    expect(architecture.default_policy).toBe('deny')
    expect(architecture.status).toBe('foundation-only-no-runtime')
    expect(architecture.agent_roles.length).toBeGreaterThanOrEqual(4)
    for (const agent of architecture.agent_roles) {
      expect(agent.may_prepare).toBe(true)
      expect(agent.may_human_approve).toBe(false)
      expect(agent.may_release).toBe(false)
    }
    expect(architecture.human_gates).toEqual([
      'technical-review',
      'instructional-review',
      'final-content-approval',
      'publication-approval',
    ])
    expect(architecture.phase_invariants.assessment_eligible).toBe(false)
    expect(architecture.phase_invariants.scored_assessment_approved).toBe(false)
    expect(architecture.phase_invariants.interactive_runtime_deferred).toBe(true)
    expect(architecture.phase_invariants.blender_execution_deferred).toBe(true)
  })

  test('rejects invented engineering artifact references', () => {
    const { dir, result } = withManifest((candidate) => {
      candidate.evidence.engineeringArtifactRefs = ['data/engineering/not-a-real-artifact.json']
    })
    try { expect(result.errors.join('\n')).toMatch(/engineering artifact reference does not exist/) }
    finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })

  test('preserves the no-React architecture as ANIM-1B introduces governed Three.js', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(dependencies.three).toBe('^0.186.1')
    expect(dependencies.react).toBeUndefined()
    expect(dependencies['@react-three/fiber']).toBeUndefined()
  })
})
