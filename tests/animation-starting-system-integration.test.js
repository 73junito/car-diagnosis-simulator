/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const readJson = (relative) => JSON.parse(read(relative))

describe('ANIM-2A Starting System production integration contract', () => {
  const registry = readJson('data/architecture/student-lab-animation-source-of-truth.json')
  const integration = registry.lab_integrations.find((item) => item.lab_id === 'starting-system-lab')

  test('binds the Starting System Lab to the governed source-of-truth registry', () => {
    const html = read('dashboard/student/starting-system-lab/index.html')
    const module = read('dashboard/student/starting-system-lab/starting-system-animation.js')

    expect(html).toContain('id="startingAnimationPlayer"')
    expect(html).toContain('id="startingLegacyVisualization"')
    expect(html).toContain('href="/theme/components/animation-player/animation-player.css"')
    expect(html).toContain('src="./starting-system-animation.js"')
    expect(module).toContain('/data/architecture/student-lab-animation-source-of-truth.json')
    expect(module).toContain("lab_id === 'starting-system-lab'")
    expect(module).toContain('/theme/components/animation-player/animation-player.js')
    expect(module).toContain('allowDraft: false')
    expect(module).not.toContain('allowDraft: true')
  })

  test('keeps the governed manifest unpublished and the legacy schematic as fallback', () => {
    const foundation = readJson(integration.production_manifest)
    expect(foundation.governance.humanApprovalRecorded).toBe(false)
    expect(foundation.governance.publicationAllowed).toBe(false)
    expect(foundation.governance.assessmentEligible).toBe(false)
    expect(foundation.governance.scoredAssessmentApproved).toBe(false)
    expect(integration.legacy_visualization.role).toBe('transitional-static-and-2d-fallback')
    expect(integration.legacy_visualization.authoritative_animation_source).toBe(false)
  })

  test('packages only the approved production foundation and integration runtime, not review assets', () => {
    const build = read('scripts/build-static-site.js')
    expect(build).toContain('"data/architecture/student-lab-animation-source-of-truth.json"')
    expect(build).toContain('"dashboard/student/starting-system-lab/starting-system-animation.js"')
    expect(build).toContain('"animation/manifests/starting-system-voltage-drop-foundation.json"')
    expect(build).not.toContain('"animation/manifests/starting-system-voltage-drop-review.json"')
    expect(build).not.toContain('"animation/review-assets/starting-system-voltage-drop-review.glb"')
  })
})
