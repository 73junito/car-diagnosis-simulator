const fs = require('fs')
const os = require('os')
const path = require('path')
const { verifyStaticContract, validateGeneratedAsset } = require('../scripts/verify-blender-animation-pipeline')
const { findBlender, parseCli } = require('../scripts/run-blender-animation-pipeline')

describe('ANIM-1C Blender pipeline contract', () => {
  test('defines a headless, non-publishable, assessment-ineligible pipeline', () => {
    const result = verifyStaticContract()
    expect(result.errors).toEqual([])
    expect(result.pipeline.phase).toBe('ANIM-1C')
    expect(result.pipeline.governance).toMatchObject({
      mayPublish: false,
      mayAttachToProductionLesson: false,
      assessmentEligible: false,
      scoredAssessmentApproved: false,
      humanApprovalRequired: true,
      agentMayApprove: false,
      agentMayRelease: false,
    })
  })

  test('supports portable Blender discovery without personal profile paths', () => {
    const runner = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'run-blender-animation-pipeline.js'), 'utf8')
    expect(runner).toContain('BLENDER_EXE')
    expect(runner).not.toContain('AppData')
    expect(runner).not.toContain('rod63')
    expect(runner).toContain('did not produce the required GLB and metadata outputs')
    expect(typeof findBlender).toBe('function')
  })

  test('parses explicit manifest/output/metadata overrides deterministically', () => {
    const parsed = parseCli(['node','runner','--manifest','a.json','--output','b.glb','--metadata','c.json'])
    expect(parsed.manifest).toBe(path.resolve('a.json'))
    expect(parsed.output).toBe(path.resolve('b.glb'))
    expect(parsed.metadata).toBe(path.resolve('c.json'))
  })


  test('keeps Blender authoring scripts out of the static deployment surface', () => {
    const build = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'build-static-site.js'), 'utf8')
    expect(build).not.toMatch(/runtimeDirectories\s*=\s*\[[\s\S]*?["']animation["']/)
    expect(build).toContain('source: "animation/manifests/starting-system-voltage-drop-foundation.json"')
    expect(build).not.toContain('source: "animation/blender"')
  })

  test('generated-asset validator rejects a fake GLB', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anim1c-'))
    const glb = path.join(dir, 'fake.glb')
    const metadata = path.join(dir, 'fake.json')
    fs.writeFileSync(glb, 'not-a-glb')
    fs.writeFileSync(metadata, JSON.stringify({
      outputSha256: 'x', outputBytes: 9, assetStatus: 'pipeline-validation-only',
      mayPublish: false, assessmentEligible: false, scoredAssessmentApproved: false,
      agentMayApprove: false, agentMayRelease: false, componentIds: ['one']
    }))
    try {
      const result = validateGeneratedAsset(glb, metadata)
      expect(result.errors.join('\n')).toMatch(/valid GLB header/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
