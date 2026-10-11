/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const html = fs.readFileSync(path.resolve('dashboard/instructor/research/index.html'), 'utf8')
const css = fs.readFileSync(path.resolve('dashboard/instructor/research/research.css'), 'utf8')

describe('Instructor research theme conformance', () => {
  test('uses canonical theme layers without root theme.css', () => {
    expect(html).not.toContain('href="/theme.css"')
    expect(html).toContain('href="/theme/tokens.css"')
    expect(html).toContain('href="/theme/layout.css"')
    expect(html).toContain('href="/theme/dashboard.css"')
    expect(html).toContain('href="./research.css"')
    expect(html).toContain('<main class="tm-main">')
  })

  test('uses canonical form controls and no inline presentation styles', () => {
    expect(html).toContain('class="tm-select"')
    expect(html).toContain('class="tm-textarea"')
    expect(html).toContain('class="tm-input research-query-input"')
    expect(html).not.toContain('style=')
  })

  test('keeps dynamically generated fine-print presentation in the local visual layer', () => {
    expect(css).toContain('.fine-print')
    expect(css).toContain('color: var(--tm-muted)')
    expect(css).toContain('.research-provider-logo')
  })
})
