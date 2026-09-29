/** @jest-environment node */
import {
  searchSemanticScholar,
  getSemanticScholarPaper,
  _resetSemanticScholarStateForTests
} from '../worker/services/semantic-scholar.js'

function quotaNamespace(status = 200, payload = { allowed: true, count: 1, remaining: 0 }) {
  const fetchMock = jest.fn(async () => new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  }))
  return {
    fetchMock,
    binding: {
      idFromName: jest.fn(() => 'semantic-scholar-do-id'),
      get: jest.fn(() => ({ fetch: fetchMock }))
    }
  }
}

describe('Semantic Scholar research service', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    _resetSemanticScholarStateForTests()
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  test('search sends API key server-side and normalizes metadata', async () => {
    const quota = quotaNamespace()
    global.fetch = jest.fn(async (url, init) => {
      expect(String(url)).toContain('/graph/v1/paper/search')
      expect(init.headers['x-api-key']).toBe('test-secret')
      return new Response(JSON.stringify({
        total: 1,
        offset: 0,
        data: [{
          paperId: 'P1',
          title: 'Example paper',
          abstract: 'Example abstract',
          authors: [{ authorId: 'A1', name: 'Author One' }],
          year: 2026,
          venue: 'Example Venue',
          externalIds: { DOI: '10.1234/example' },
          url: 'https://www.semanticscholar.org/paper/P1',
          citationCount: 4
        }]
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })

    const result = await searchSemanticScholar('automotive diagnostics', 5, {
      SEMANTIC_SCHOLAR_API_KEY: 'test-secret',
      TORQUEMIND_RATE_LIMITER: quota.binding,
      SEMANTIC_SCHOLAR_RATE_WINDOW_SECONDS: '2'
    })

    expect(result.provider).toBe('Semantic Scholar')
    expect(result.reviewStatus).toBe('unreviewed')
    expect(result.assessmentEligibility).toBe('none')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].externalIds.DOI).toBe('10.1234/example')
    expect(quota.binding.idFromName).toHaveBeenCalledWith('semantic-scholar-global')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('deduplicates cached identical searches without another upstream request', async () => {
    const quota = quotaNamespace()
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      total: 0,
      offset: 0,
      data: []
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const env = {
      SEMANTIC_SCHOLAR_API_KEY: 'test-secret',
      TORQUEMIND_RATE_LIMITER: quota.binding
    }

    const first = await searchSemanticScholar('battery management', 5, env)
    const second = await searchSemanticScholar('battery management', 5, env)

    expect(first.cache).toBe('miss')
    expect(second.cache).toBe('memory-hit')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(quota.fetchMock).toHaveBeenCalledTimes(1)
  })

  test('fails closed when the global quota object is busy', async () => {
    const quota = quotaNamespace(429, {
      allowed: false,
      retryAfterSeconds: 2
    })
    global.fetch = jest.fn()

    await expect(searchSemanticScholar('vehicle cybersecurity', 5, {
      SEMANTIC_SCHOLAR_API_KEY: 'test-secret',
      TORQUEMIND_RATE_LIMITER: quota.binding
    })).rejects.toMatchObject({
      code: 'LOCAL_RATE_LIMITED',
      retryAfterSeconds: 2
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('paper metadata lookup is normalized and marked unreviewed', async () => {
    const quota = quotaNamespace()
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      paperId: 'CorpusId:123',
      title: 'Paper title',
      authors: [],
      externalIds: { CorpusId: 123 }
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const result = await getSemanticScholarPaper('CorpusId:123', {
      SEMANTIC_SCHOLAR_API_KEY: 'test-secret',
      TORQUEMIND_RATE_LIMITER: quota.binding
    })

    expect(result.usage).toBe('research-metadata')
    expect(result.reviewStatus).toBe('unreviewed')
    expect(result.assessmentEligibility).toBe('none')
    expect(result.data.paperId).toBe('CorpusId:123')
  })

  test('never accepts an empty API key', async () => {
    const quota = quotaNamespace()
    await expect(searchSemanticScholar('automotive education', 5, {
      TORQUEMIND_RATE_LIMITER: quota.binding
    })).rejects.toMatchObject({ code: 'API_KEY_NOT_CONFIGURED' })
  })
})
