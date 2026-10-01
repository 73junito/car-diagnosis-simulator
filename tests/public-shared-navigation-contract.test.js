import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const styles = fs.readFileSync(path.join(root, 'public-site/styles.css'), 'utf8')
const researchPage = fs.readFileSync(
  path.join(root, 'public-site/research-sources/index.html'),
  'utf8'
)

describe('shared public navigation contract', () => {
  test('responsive collapse is scoped to the homepage menu', () => {
    expect(styles).toContain('#mainNav {')
    expect(styles).toContain('#mainNav.open {')
    expect(styles).not.toMatch(/@media\s*\(max-width:\s*980px\)[\s\S]*?\.nav-links\s*\{\s*display:\s*none;/)
  })

  test('research sources navigation remains a shared nav without homepage toggle dependency', () => {
    expect(researchPage).toContain('<nav class="nav-links">')
    expect(researchPage).not.toContain('id="mainNav"')
    expect(researchPage).not.toContain('id="navToggle"')
    expect(researchPage).toContain('>Home</a>')
    expect(researchPage).toContain('>Launch Platform</a>')
  })
})
