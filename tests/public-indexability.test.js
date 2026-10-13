const fs = require('fs')
const path = require('path')
const {
  EXPECTED_URLS,
  extractLocs,
  routeToFile,
  canonicalFromHtml,
  audit
} = require('../scripts/verify-public-indexability.js')

describe('public indexability and 404 audit', () => {
  test('sitemap exposes the complete canonical public inventory', () => {
    const xml = fs.readFileSync(path.join(__dirname, '..', 'public-site', 'sitemap.xml'), 'utf8')
    expect(extractLocs(xml)).toEqual(EXPECTED_URLS)
  })

  test.each(EXPECTED_URLS)('sitemap URL has a real file and matching canonical: %s', (url) => {
    const file = routeToFile(url)
    expect(fs.existsSync(file)).toBe(true)
    const html = fs.readFileSync(file, 'utf8')
    expect(canonicalFromHtml(html)).toBe(url)
  })

  test('public site has no broken internal anchor destinations', () => {
    expect(audit()).toEqual({
      ok: true,
      errors: [],
      urls: EXPECTED_URLS.length
    })
  })
})
