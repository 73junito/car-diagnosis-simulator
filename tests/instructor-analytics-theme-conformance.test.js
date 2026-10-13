/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const html = fs.readFileSync(path.resolve('dashboard/instructor/analytics.html'), 'utf8')
const js = fs.readFileSync(path.resolve('dashboard/instructor/analytics.js'), 'utf8')
const css = fs.readFileSync(path.resolve('dashboard/instructor/analytics.css'), 'utf8')
const bridge = fs.readFileSync(path.resolve('theme/legacy-light-bridge.css'), 'utf8')

describe('Instructor analytics theme conformance', () => {
  test('uses canonical theme layers plus the compatibility bridge without root theme.css', () => {
    expect(html).not.toContain('href="/theme.css"')
    expect(html).toContain('href="/theme/tokens.css"')
    expect(html).toContain('href="/theme/layout.css"')
    expect(html).toContain('href="/theme/dashboard.css"')
    expect(html).toContain('href="./analytics.css"')
    expect(html).toContain('href="/theme/legacy-light-bridge.css"')
    expect(html).toContain('<main class="tm-main">')
  })

  test('removes legacy presentation aliases while preserving the .value JS hook', () => {
    expect(html).not.toContain('class="cards ')
    expect(html).not.toContain('class="label ')
    expect(html).not.toContain('class="btn ')
    expect(html).not.toContain('class="students ')
    expect(html).not.toContain('class="card tm-panel"')
    expect(html.match(/class="value tm-stat-card__value"/g)).toHaveLength(4)
    expect(js).toContain("document.querySelector('#card-total .value')")
    expect(js).toContain("document.querySelector('#card-confidence .value')")
    expect(js).toContain("document.querySelector('#card-time .value')")
    expect(js).toContain("document.querySelector('#card-safety .value')")
  })

  test('keeps runtime metric and badge classes bridge-backed', () => {
    expect(js).toContain("sessions.className = 'metric-small'")
    expect(js).toContain("scoreSpan.className='metric'")
    expect(js).toContain("confSpan.className='metric'")
    expect(js).toContain("classList.add('badge-success')")
    expect(js).toContain("classList.add('badge-warn')")
    expect(js).toContain("classList.add('badge-danger')")
    expect(bridge).toContain('.metric-small')
    expect(bridge).toContain('.metric,')
    expect(bridge).toContain('.badge-success,')
    expect(bridge).toContain('.badge-warn,')
    expect(bridge).toContain('.badge-danger,')
    expect(css).toContain('.analytics-actions')
    expect(css).toContain('.analytics-section')
  })
})
