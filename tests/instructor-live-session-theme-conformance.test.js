/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const html = fs.readFileSync(path.resolve('dashboard/instructor/live-session.html'), 'utf8')
const js = fs.readFileSync(path.resolve('dashboard/instructor/live-session.js'), 'utf8')
const liveCss = fs.readFileSync(path.resolve('dashboard/live-session.css'), 'utf8')
const bridge = fs.readFileSync(path.resolve('theme/legacy-light-bridge.css'), 'utf8')

describe('Instructor live-session theme conformance', () => {
  test('uses canonical theme layers plus the existing legacy compatibility bridge', () => {
    expect(html).not.toContain('href="/theme.css"')
    expect(html).toContain('href="/theme/tokens.css"')
    expect(html).toContain('href="/theme/layout.css"')
    expect(html).toContain('href="/theme/dashboard.css"')
    expect(html).toContain('href="/theme/legacy-light-bridge.css"')
    expect(html).toContain('<main class="tm-main">')
  })

  test('references the existing shared live-session stylesheet instead of the missing instructor-relative path', () => {
    expect(html).toContain('href="/dashboard/live-session.css"')
    expect(html).not.toContain('href="./live-session.css"')
    expect(liveCss).toContain('.live-list')
    expect(liveCss).toContain('#live-summary')
  })

  test('keeps runtime status behavior bridge-backed', () => {
    expect(js).toContain("status.className = 'badge ' + (cls || 'badge-warn')")
    expect(js).toContain("'badge-success'")
    expect(js).toContain("'badge-danger'")
    expect(bridge).toContain('#conn-status.badge-success')
    expect(bridge).toContain('#conn-status.badge-warn')
    expect(bridge).toContain('#conn-status.badge-danger')
  })

  test('uses canonical auth and owned-class controls instead of browser role trust', () => {
    expect(html).toContain('id="live-class"')
    expect(html).toContain('src="/auth.js"')
    expect(html).toContain('src="/apiClient.js"')
    expect(js).toContain("window.apiGet('/api/classes')")
    expect(js).toContain("Authorization: 'Bearer ' + token")
    expect(js).not.toContain("localStorage.getItem('torquemindRole')")
    expect(js).not.toContain('new EventSource')
  })
})
