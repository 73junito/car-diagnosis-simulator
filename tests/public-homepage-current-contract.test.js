import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const home = fs.readFileSync(path.join(root, 'public-site/index.html'), 'utf8')

describe('current public homepage contract', () => {
  test('uses current evidence-governed positioning', () => {
    expect(home).toContain('Build Automotive Diagnostic Reasoning Through Guided, Evidence-Governed Learning')
    expect(home).toContain('Curriculum-First Learning')
    expect(home).toContain('Governed Technical References')
    expect(home).toContain('Evidence before answers')
    expect(home).toContain('Federal School Code')
  })

  test('keeps student and instructor entry points explicit', () => {
    expect(home).toContain('https://app.autolearnpro.com/sign-in/student/')
    expect(home).toContain('https://app.autolearnpro.com/sign-in/instructor/')
    expect(home).toContain('https://exam.autolearnpro.com/learning-path/')
  })

  test('does not restore outdated assessment or tutor marketing claims', () => {
    for (const outdated of [
      '20-question attempts',
      'refreshed question sets after repeated failures',
      'measurable student performance',
      'Evidence-Grounded AI Tutor',
      'Built to teach—not to guess',
      'We only use approved technical sources'
    ]) {
      expect(home).not.toContain(outdated)
    }
  })
})
