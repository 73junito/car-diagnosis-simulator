const { USER_AGENTS, probe } = require('../scripts/verify-google-crawler-access.js')

function fakeResponse(status, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] || null }
  }
}

describe('Google crawler access probe', () => {
  test('uses the current Google Inspection Tool token', () => {
    expect(USER_AGENTS[0].value).toContain('Google-InspectionTool/1.0')
    expect(USER_AGENTS[0].value).not.toContain('Google-InspectionTool/1.0;')
  })

  test('passes when crawler requests receive 2xx', async () => {
    const seen = []
    const results = await probe('https://example.test/', async (_url, init) => {
      seen.push(init.headers['User-Agent'])
      return fakeResponse(200, { server: 'cloudflare' })
    })
    expect(results.every((x) => x.ok)).toBe(true)
    expect(seen).toHaveLength(2)
  })

  test('surfaces a 403 crawler denial', async () => {
    const results = await probe('https://example.test/', async (_url, init) => {
      return fakeResponse(
        init.headers['User-Agent'].includes('Google-InspectionTool') ? 403 : 200,
        { 'cf-ray': 'test-ray', server: 'cloudflare' }
      )
    })
    expect(results.find((x) => x.crawler === 'Google-InspectionTool')).toMatchObject({
      status: 403,
      ok: false,
      cfRay: 'test-ray'
    })
  })
})
