/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const slugs = ['about', 'how-it-works', 'students', 'instructors', 'help']
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

describe('Phase 2 public content pass', () => {
  test.each(slugs)('%s page exists with canonical metadata and shared shell', (slug) => {
    const html = read(`public-site/${slug}/index.html`)
    expect(html).toContain(`<link rel="canonical" href="https://autolearnpro.com/${slug}/" />`)
    expect(html).toContain('href="/styles.css"')
    expect(html).toContain('aria-label="Primary navigation"')
    expect(html).toContain('href="/about/"')
    expect(html).toContain('href="/how-it-works/"')
    expect(html).toContain('href="/students/"')
    expect(html).toContain('href="/instructors/"')
    expect(html).toContain('href="/institutions/"')
    expect(html).toContain('href="/help/"')
    expect(html).toContain('aria-label="Footer navigation"')
  })

  test('homepage exposes all five new public routes', () => {
    const home = read('public-site/index.html')
    for (const slug of slugs) expect(home).toContain(`href="/${slug}/"`)
  })

  test('sitemap publishes all Phase 2 routes', () => {
    const sitemap = read('public-site/sitemap.xml')
    for (const slug of slugs) expect(sitemap).toContain(`<loc>https://autolearnpro.com/${slug}/</loc>`)
  })

  test('role and governance boundaries remain cautious', () => {
    const students = read('public-site/students/index.html')
    const instructors = read('public-site/instructors/index.html')
    const about = read('public-site/about/index.html')
    expect(students).toContain('does not by itself mean it is approved for graded assessment')
    expect(instructors).toContain('affiliation verification')
    expect(instructors).toContain('does not automatically grant instructor privileges')
    expect(about).toContain('Availability of individual courses, scenarios, assessment features, and institution-level capabilities may vary')
  })

  test('shared stylesheet owns the new subpage presentation', () => {
    const css = read('public-site/styles.css')
    expect(css).toContain('Shared Phase 2 public content pages.')
    expect(css).toContain('.public-page-hero')
    expect(css).toContain('.public-step-list')
    expect(css).toContain('.public-page-notice')
  })
})
