const {
  USER_AGENTS,
  hasNoindex,
  probe,
  probeInventory
} = require('../scripts/verify-google-crawler-access.js')

function fakeResponse(status, {
  headers = {},
  url = 'https://example.test/',
  body = '<link rel="canonical" href="https://example.test/" />'
} = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    url,
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    text: async () => body
  }
}

describe('Google crawler access probe', () => {
  test('uses the current Google Inspection Tool token', () => {
    expect(USER_AGENTS[0].value).toContain('Google-InspectionTool/1.0')
    expect(USER_AGENTS[0].value).not.toContain('Google-InspectionTool/1.0;')
  })

  test('passes when crawler requests receive canonical 2xx responses', async () => {
    const seen = []
    const results = await probe('https://example.test/', async (_url, init) => {
      seen.push(init.headers['User-Agent'])
      return fakeResponse(200, { headers: { server: 'cloudflare' } })
    })

    expect(results.every((x) => x.ok)).toBe(true)
    expect(results.every((x) => x.canonical === 'https://example.test/')).toBe(true)
    expect(seen).toHaveLength(2)
  })

  test('surfaces a 403 crawler denial', async () => {
    const results = await probe('https://example.test/', async (_url, init) => {
      return fakeResponse(
        init.headers['User-Agent'].includes('Google-InspectionTool') ? 403 : 200,
        { headers: { 'cf-ray': 'test-ray', server: 'cloudflare' } }
      )
    })

    expect(results.find((x) => x.crawler === 'Google-InspectionTool')).toMatchObject({
      status: 403,
      ok: false,
      httpOk: false,
      cfRay: 'test-ray'
    })
  })

  test('fails closed on noindex response headers or meta tags', async () => {
    const headerResults = await probe('https://example.test/', async () =>
      fakeResponse(200, { headers: { 'x-robots-tag': 'noindex, follow' } })
    )
    expect(headerResults.every((x) => x.noindex && !x.ok)).toBe(true)

    const metaResults = await probe('https://example.test/', async () =>
      fakeResponse(200, {
        body: '<meta name="robots" content="noindex,follow"><link rel="canonical" href="https://example.test/" />'
      })
    )
    expect(metaResults.every((x) => x.noindex && !x.ok)).toBe(true)
    expect(hasNoindex('index,follow')).toBe(false)
  })

  test('fails closed on redirect or canonical drift', async () => {
    const redirectResults = await probe('https://example.test/', async () =>
      fakeResponse(200, {
        url: 'https://example.test/other/',
        body: '<link rel="canonical" href="https://example.test/" />'
      })
    )
    expect(redirectResults.every((x) => x.redirectDrift && !x.ok)).toBe(true)

    const canonicalResults = await probe('https://example.test/', async () =>
      fakeResponse(200, {
        body: '<link rel="canonical" href="https://example.test/other/" />'
      })
    )
    expect(canonicalResults.every((x) => x.canonicalMismatch && !x.ok)).toBe(true)
  })

  test('audits every URL with both crawler identities', async () => {
    const urls = ['https://example.test/', 'https://example.test/demo/']
    const results = await probeInventory(urls, async (url) =>
      fakeResponse(200, {
        url,
        body: `<link rel="canonical" href="${url}" />`
      })
    )

    expect(results).toHaveLength(urls.length * USER_AGENTS.length)
    expect(results.every((x) => x.ok)).toBe(true)
  })
})
