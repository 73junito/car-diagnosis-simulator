import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const rawHome = fs.readFileSync(path.join(root, 'public-site/index.html'), 'utf8')
const home = rawHome.replace(/\s+/g, ' ')

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
