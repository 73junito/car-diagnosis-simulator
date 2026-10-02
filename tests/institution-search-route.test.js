jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

const { createClient } = require('@supabase/supabase-js')
const {
  handleInstitutionSearch,
  normalizeSearch
} = require('../worker/routes/institution-search.js')

function makeContext(query = '') {
  return {
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role'
    },
    req: {
      method: 'GET',
      query: jest.fn((name) => name === 'q' ? query : undefined)
    },
    json: jest.fn((payload, status = 200) => ({ payload, status }))
  }
}

function makeInstitutionQuery(rows = []) {
  const query = {}
  query.select = jest.fn(() => query)
  query.eq = jest.fn(() => query)
  query.ilike = jest.fn(() => query)
  query.order = jest.fn(() => query)
  query.limit = jest.fn().mockResolvedValue({ data: rows, error: null })
  return query
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('public institution search route', () => {
  test('normalizes and bounds search input', () => {
    expect(normalizeSearch('  State   College  ')).toBe('State College')
    expect(normalizeSearch('%State_College%')).toBe('StateCollege')
    expect(normalizeSearch('x'.repeat(100))).toHaveLength(80)
  })

  test('returns no results for searches shorter than two characters', async () => {
    const response = await handleInstitutionSearch(makeContext('A'))
    expect(response.status).toBe(200)
    expect(response.payload.institutions).toEqual([])
    expect(createClient).not.toHaveBeenCalled()
  })

  test('returns only limited institution identity fields', async () => {
    const query = makeInstitutionQuery([
      {
        school_code: '001234',
        school_name: 'Example Community College',
        city: 'Example City',
        state_code: 'KS',
        country: 'USA',
        address: 'not returned'
      }
    ])
    createClient.mockReturnValue({
      from: jest.fn(() => query)
    })

    const response = await handleInstitutionSearch(makeContext('Example'))

    expect(response.status).toBe(200)
    expect(query.select).toHaveBeenCalledWith(
      'school_code,school_name,city,state_code,country'
    )
    expect(query.eq).toHaveBeenCalledWith('active', true)
    expect(query.ilike).toHaveBeenCalledWith('school_name', '%Example%')
    expect(query.limit).toHaveBeenCalledWith(10)
    expect(response.payload.institutions).toEqual([
      {
        schoolCode: '001234',
        schoolName: 'Example Community College',
        city: 'Example City',
        stateCode: 'KS',
        country: 'USA'
      }
    ])
    expect(response.payload.institutions[0].address).toBeUndefined()
  })
})
