const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')

describe('AutoLearnPro user-facing branding polish', () => {
  test('primary user-facing surfaces use AutoLearnPro branding', () => {
    const files = [
      'index.html',
      'docs.html',
      'docs/index.html',
      'dashboard/author/index.html',
      'public-site/terms.html',
      'public-site/contact.html'
    ]

    for (const file of files) {
      expect(read(file)).not.toMatch(/TorqueMind/)
    }

    expect(read('index.html')).toContain('<title>AutoLearnPro - Automotive Diagnostic Training</title>')
    expect(read('docs.html')).toContain('<title>AutoLearnPro Documentation</title>')
    expect(read('docs/index.html')).toContain('<h1 class="tm-hero-banner__title">AutoLearnPro Docs</h1>')
    expect(read('dashboard/author/index.html')).toContain('<title>AutoLearnPro Authoring Studio</title>')
  })

  test('exam 404 uses the shared exam presentation and preserves prelaunch boundaries', () => {
    const html = read('exam-site/404.html')
    expect(html).toContain('<link rel="stylesheet" href="/styles.css">')
    expect(html).toContain('class="site-header"')
    expect(html).toContain('class="shell header-inner"')
    expect(html).toContain('<main id="main">')
    expect(html).toContain('Page not found')
    expect(html).toContain('Exam launch pending')
    expect(html).toContain('No purchase or scored attempt available')
    expect(html).toContain('<footer>')
  })

  test('exam navigation source contains the intended external-link glyph without replacement characters', () => {
    const htmlFiles = []
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(full)
      }
    }
    walk(path.join(root, 'exam-site'))

    const corpus = htmlFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
    expect(corpus).toContain('Training app <span aria-hidden="true">↗</span>')
    expect(corpus).not.toContain('�')
  })
})
