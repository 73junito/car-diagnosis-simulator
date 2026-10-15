const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const readJson = (relative) => JSON.parse(read(relative))

describe('ANIM-2D Starting System review harness', () => {
  test('is explicitly review-only and mounts the governed player with draft preview enabled', () => {
    const html = read('animation/review-harness/starting-system.html')
    const module = read('animation/review-harness/review-harness.js')
    expect(html).toContain('Internal review surface')
    expect(html).toContain('noindex,nofollow,noarchive')
    expect(module).toContain("MANIFEST_URL = '/animation/manifests/starting-system-voltage-drop-review.json'")
    expect(module).toContain('allowDraft: true')
    expect(module).toContain('publicationAllowed !== false')
    expect(module).toContain('assessmentEligible !== false')
  })

  test('assembles review output only after the normal production dist exists', () => {
    const build = read('scripts/build-animation-review-harness.js')
    expect(build).toContain('const production = path.join(root, "dist")')
    expect(build).toContain('const reviewOutput = path.join(root, "review-dist")')
    expect(build).toContain('fs.cpSync(production, reviewOutput')
    expect(build).toContain('publicationAllowed !== false')
    expect(build).toContain('humanApprovalRecorded !== false')
  })

  test('keeps review harness and review assets outside the production static build allowlist', () => {
    const build = read('scripts/build-static-site.js')
    expect(build).not.toContain('animation/review-harness')
    expect(build).not.toContain('animation/review-assets')
    expect(build).not.toContain('starting-system-voltage-drop-review.json')
  })

  test('runs the review harness in the existing Playwright CI workflow', () => {
    const workflow = read('.github/workflows/playwright-tests.yml')
    expect(workflow).toContain('npm run test:animation-review-harness --silent')
  })

  test('uses the four governed Starting System clips without changing publication or assessment state', () => {
    const manifest = readJson('animation/manifests/starting-system-voltage-drop-review.json')
    expect(manifest.presentation.mode).toBe('animated')
    expect(manifest.presentation.clips.map((clip) => clip.assetClipName)).toEqual([
      'identify-current-path',
      'identify-control-path',
      'select-measurement-path',
      'interpret-with-evidence',
    ])
    expect(manifest.governance).toMatchObject({
      humanApprovalRecorded: false,
      publicationAllowed: false,
      assessmentEligible: false,
      scoredAssessmentApproved: false,
      agentMayApprove: false,
      agentMayRelease: false,
    })
  })
})
