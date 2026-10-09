'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public-site')
const SITEMAP = path.join(PUBLIC, 'sitemap.xml')

const EXPECTED_URLS = [
  'https://autolearnpro.com/',
  'https://autolearnpro.com/institutions/',
  'https://autolearnpro.com/research-sources/',
  'https://autolearnpro.com/privacy',
  'https://autolearnpro.com/terms',
  'https://autolearnpro.com/contact',
  'https://autolearnpro.com/accessibility/'
]

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
}

function routeToFile(urlString) {
  const url = new URL(urlString)
  const pathname = url.pathname

  if (pathname === '/') return path.join(PUBLIC, 'index.html')
  if (pathname.endsWith('/')) return path.join(PUBLIC, pathname.slice(1), 'index.html')

  const direct = path.join(PUBLIC, pathname.slice(1))
  if (fs.existsSync(direct)) return direct

  const html = direct + '.html'
  if (fs.existsSync(html)) return html

  return direct
}

function canonicalFromHtml(html) {
  const match = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["'][^>]*>/i)
  return match ? match[1] : null
}

function walkHtml(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkHtml(absolute))
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(absolute)
  }
  return files
}

function resolveInternalHref(href) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null
  if (/^https?:\/\//i.test(href)) {
    const url = new URL(href)
    if (url.hostname !== 'autolearnpro.com') return null
    href = url.pathname
  }

  const clean = href.split('#')[0].split('?')[0]
  if (!clean.startsWith('/')) return null
  if (clean === '/') return path.join(PUBLIC, 'index.html')
  if (clean.endsWith('/')) return path.join(PUBLIC, clean.slice(1), 'index.html')

  const direct = path.join(PUBLIC, clean.slice(1))
  if (fs.existsSync(direct)) return direct
  if (fs.existsSync(direct + '.html')) return direct + '.html'
  return direct
}

function audit() {
  const errors = []
  const xml = fs.readFileSync(SITEMAP, 'utf8')
  const locs = extractLocs(xml)

  if (JSON.stringify(locs) !== JSON.stringify(EXPECTED_URLS)) {
    errors.push('sitemap URL set/order does not match canonical public inventory')
  }

  for (const url of locs) {
    const file = routeToFile(url)
    if (!fs.existsSync(file)) {
      errors.push(`sitemap URL has no public file: ${url} -> ${path.relative(ROOT, file)}`)
      continue
    }
    if (file.endsWith('.html')) {
      const html = fs.readFileSync(file, 'utf8')
      const canonical = canonicalFromHtml(html)
      if (canonical !== url) {
        errors.push(`canonical mismatch: ${path.relative(ROOT, file)} expected ${url}, found ${canonical || 'none'}`)
      }
    }
  }

  for (const file of walkHtml(PUBLIC)) {
    const html = fs.readFileSync(file, 'utf8')
    for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
      const href = match[1]
      const target = resolveInternalHref(href)
      if (target && !fs.existsSync(target)) {
        errors.push(`broken internal link: ${path.relative(ROOT, file)} -> ${href}`)
      }
    }
  }

  return { ok: errors.length === 0, errors, urls: locs.length }
}

function main() {
  const result = audit()
  if (!result.ok) {
    console.error('[FAIL] Public indexability and 404 audit')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log(`[PASS] Public indexability and 404 audit: ${result.urls} sitemap URLs; no broken internal links`)
}

if (require.main === module) main()

module.exports = {
  EXPECTED_URLS,
  extractLocs,
  routeToFile,
  canonicalFromHtml,
  resolveInternalHref,
  audit
}
