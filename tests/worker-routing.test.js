import worker from '../worker/index.js'

describe('Worker production routing', () => {
  test('returns 404 for an unknown static route without an asset binding', async () => {
    const response = await worker.fetch(
      new Request('https://autolearnpro.com/definitely-missing-audit-path'),
      {},
      {}
    )

    expect(response.status).toBe(404)
  })

  test('accepts feedback preflight from the production app origin', async () => {
    const response = await worker.fetch(
      new Request('https://autolearnpro.com/api/torquemind-feedback', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://app.autolearnpro.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      }),
      {},
      {}
    )

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin'))
      .toBe('https://app.autolearnpro.com')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  test('adds CORS headers to feedback responses for the production app', async () => {
    const response = await worker.fetch(
      new Request('https://autolearnpro.com/api/torquemind-feedback', {
        method: 'POST',
        headers: {
          Origin: 'https://app.autolearnpro.com',
          'Content-Type': 'application/json'
        },
        body: '{}'
      }),
      {},
      {}
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('Access-Control-Allow-Origin'))
      .toBe('https://app.autolearnpro.com')
  })

  test('does not allow arbitrary origins', async () => {
    const response = await worker.fetch(
      new Request('https://autolearnpro.com/api/torquemind-feedback', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://malicious.example',
          'Access-Control-Request-Method': 'POST'
        }
      }),
      {},
      {}
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('https://malicious.example')
  })
})
