/** @jest-environment node */
import worker from '../worker/index.js'

describe('Worker production routing', () => {
  test('reports production orchestration persistence wiring as healthy', async () => {
    const response = await worker.fetch(
      new Request('https://app.autolearnpro.com/api/health'),
      {
        TORQUEMIND_ENVIRONMENT: 'production',
        TORQUEMIND_ORCHESTRATION_PERSISTENCE: 'supabase',
        TORQUEMIND_ORCHESTRATION_SUPABASE_PROJECT_REF: 'pffdgqpynpbffbcnxmum',
        SUPABASE_URL: 'https://pffdgqpynpbffbcnxmum.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'server-only-placeholder'
      },
      {}
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      orchestrationPersistence: {
        ok: true,
        enabled: true,
        mode: 'supabase',
        projectRef: 'pffdgqpynpbffbcnxmum',
        credentialSource: 'SUPABASE_SERVICE_ROLE_KEY'
      }
    })
  })

  test('health fails closed on a production project mismatch', async () => {
    const response = await worker.fetch(
      new Request('https://app.autolearnpro.com/api/health'),
      {
        TORQUEMIND_ENVIRONMENT: 'production',
        TORQUEMIND_ORCHESTRATION_PERSISTENCE: 'supabase',
        TORQUEMIND_ORCHESTRATION_SUPABASE_PROJECT_REF: 'pffdgqpynpbffbcnxmum',
        SUPABASE_URL: 'https://wrongproject.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'server-only-placeholder'
      },
      {}
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      status: 'degraded',
      orchestrationPersistence: {
        ok: false,
        enabled: false,
        mode: 'supabase'
      }
    })
  })

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


  test('keeps Semantic Scholar research routes disabled unless explicitly enabled', async () => {
    const response = await worker.fetch(
      new Request('https://app.autolearnpro.com/api/research/semantic-scholar/search?q=automotive'),
      {},
      {}
    )

    expect(response.status).toBe(404)
  })

  test('requires authentication before Semantic Scholar research access', async () => {
    const response = await worker.fetch(
      new Request('https://app.autolearnpro.com/api/research/semantic-scholar/search?q=automotive'),
      {
        SEMANTIC_SCHOLAR_ENABLED: 'true',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role'
      },
      {}
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
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
