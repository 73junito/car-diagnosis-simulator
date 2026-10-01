import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const rawHome = fs.readFileSync(path.join(root, 'public-site/index.html'), 'utf8')
const home = rawHome.replace(/\s+/g, ' ')
const accessibility = fs.readFileSync(path.join(root, 'public-site/accessibility/index.html'), 'utf8').replace(/\s+/g, ' ')

describe('current public homepage contract', () => {
  test('uses the redesigned diagnostic-learning positioning', () => {
    expect(home).toContain('Teach the process behind the diagnosis.')
    expect(home).toContain('Automotive learning built around diagnostic reasoning')
    expect(home).toContain('From presented concern to documented verification.')
    expect(home).toContain('Current live scenario mappings are undergraduate-only.')
    expect(home).toContain('Evidence before answers.')
    expect(home).toContain('Federal School Code')
  })

  test('keeps governance boundaries explicit', () => {
    expect(home).toContain('Citation-only material remains citation-only')
    expect(home).toContain('source-use rights')
    expect(home).toContain('AI/RAG permissions')
    expect(home).toContain('assessment eligibility')
    expect(home).toContain('Institution match does not equal authorization.')
  })

  test('keeps student, instructor, curriculum, and institution entry points explicit', () => {
    expect(home).toContain('https://app.autolearnpro.com/sign-in/student/')
    expect(home).toContain('https://app.autolearnpro.com/sign-in/instructor/')
    expect(home).toContain('https://exam.autolearnpro.com/learning-path/')
    expect(home).toContain('href="/institutions/"')
  })

  test('keeps the simplified hero and grouped legal-support footer', () => {
    expect(home).not.toContain('hero-visual')
    expect(home).not.toContain('automotive-diagnostics.svg')
    expect(home).toContain('role="group" aria-labelledby="footer-learning-heading"')
    expect(home).toContain('role="group" aria-labelledby="footer-governance-heading"')
    expect(home).toContain('role="group" aria-labelledby="footer-support-heading"')
    expect(home).toContain('id="footer-learning-heading">Learning</strong>')
    expect(home).toContain('id="footer-governance-heading">Governance</strong>')
    expect(home).toContain('id="footer-support-heading">Support</strong>')
    expect(home).toContain('href="/accessibility/"')
  })

  test('publishes a cautious accessibility support page', () => {
    expect(accessibility).toContain('<h1>Accessibility</h1>')
    expect(accessibility).toContain('Current accessibility support')
    expect(accessibility).toContain('Ongoing review')
    expect(accessibility).toContain('Report a barrier')
    expect(accessibility).toContain('is not a certification')
    expect(accessibility).toContain('href="/contact"')
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
