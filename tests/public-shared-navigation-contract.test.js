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
    expect(styles).toContain('.home-page #mainNav{')
    expect(styles).toContain('.home-page #mainNav.open{display:flex}')
    expect(styles).not.toMatch(/body:not\(\.home-page\)[\s\S]*?\.nav-links\s*\{\s*display:\s*none;/)
  })

  test('research sources navigation remains visible without homepage toggle support', () => {
    expect(researchPage).toContain('<nav class="nav-links">')
    expect(researchPage).not.toContain('id="mainNav"')
    expect(researchPage).not.toContain('id="navToggle"')
    expect(researchPage).toContain('>Home</a>')
    expect(researchPage).toContain('>Launch Platform</a>')
  })
})
