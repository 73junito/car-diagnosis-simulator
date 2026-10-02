jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))
jest.mock('../api/_utils/auth-utils.js', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseToken: jest.fn()
}))

const { createClient } = require('@supabase/supabase-js')
const authUtils = require('../api/_utils/auth-utils.js')
const {
  handleInstructorVerificationRequest,
  handleInstructorVerificationStatus
} = require('../worker/routes/instructor-verification.js')

function makeQuery({ maybeSingle = { data: null, error: null }, single } = {}) {
  const query = {}
  query.select = jest.fn(() => query)
  query.eq = jest.fn(() => query)
  query.maybeSingle = jest.fn().mockResolvedValue(maybeSingle)
  query.insert = jest.fn((row) => {
    query.insertedRow = row
    return query
  })
  query.single = jest.fn().mockResolvedValue(
    single || { data: query.insertedRow || null, error: null }
  )
  return query
}
function makeApprovedDomain(domain = 'example.edu') {
  return makeQuery({
    maybeSingle: {
      data: { school_code: '001234', domain, active: true },
      error: null
    }
  })
}

function makeContext({ method = 'GET', body = {}, query = {} } = {}) {
  return {
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role'
    },
    req: {
      method,
      header: jest.fn(() => 'Bearer token'),
      query: jest.fn((name) => query[name]),
      json: jest.fn().mockResolvedValue(body)
    },
    json: jest.fn((payload, status = 200) => ({ payload, status }))
  }
}

function setAuthenticatedUser(
  role = 'instructor',
  id = 'verified-user',
  email = 'faculty@example.edu'
) {
  authUtils.extractBearerToken.mockReturnValue('token')
  authUtils.verifySupabaseToken.mockResolvedValue({
    user: { id, email, app_metadata: { role } },
    error: null
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('instructor verification route authorization', () => {
  test('rejects unauthenticated access', async () => {
    authUtils.extractBearerToken.mockReturnValue(null)
    const response = await handleInstructorVerificationStatus(makeContext())
    expect(response.status).toBe(401)
    expect(createClient).not.toHaveBeenCalled()
  })
  test('binds a new request to the verified user ID', async () => {
    setAuthenticatedUser('student', 'verified-user')

    const institution = makeQuery({
      maybeSingle: {
        data: {
          school_code: '001234',
          school_name: 'Example College',
          active: true
        },
        error: null
      }
    })
    const domain = makeQuery({
      maybeSingle: {
        data: { school_code: '001234', domain: 'example.edu', active: true },
        error: null
      }
    })
    const request = makeQuery({
      maybeSingle: { data: null, error: null },
      single: {
        data: {
          id: 'request-1',
          school_code: '001234',
          status: 'pending'
        },
        error: null
      }
    })
    const profile = makeQuery({
      maybeSingle: { data: { role: 'student' }, error: null }
    })

    createClient.mockReturnValue({
      from: jest.fn((table) => ({
        institutions: institution,
        institution_email_domains: domain,
        instructor_verification_requests: request,
        profiles: profile
      }[table]))
    })
    const response = await handleInstructorVerificationRequest(
      makeContext({
        method: 'POST',
        body: { schoolCode: '001234', userId: 'attacker-supplied' }
      })
    )

    expect(response.status).toBe(202)
    expect(request.insert).toHaveBeenCalledTimes(1)
    expect(request.insertedRow.user_id).toBe('verified-user')
    expect(request.insertedRow.user_id).not.toBe('attacker-supplied')
  })

  test('rejects a personal email domain for instructor verification', async () => {
    setAuthenticatedUser('instructor', 'verified-user', 'person@gmail.com')

    const institution = makeQuery({
      maybeSingle: {
        data: { school_code: '001234', school_name: 'Example College', active: true },
        error: null
      }
    })
    const noDomainMatch = makeQuery({
      maybeSingle: { data: null, error: null }
    })
    const request = makeQuery()

    createClient.mockReturnValue({
      from: jest.fn((table) => ({
        institutions: institution,
        institution_email_domains: noDomainMatch,
        instructor_verification_requests: request
      }[table]))
    })

    const response = await handleInstructorVerificationRequest(
      makeContext({
        method: 'POST',
        body: { schoolCode: '001234' }
      })
    )

    expect(response.status).toBe(403)
    expect(response.payload.institutionalEmailVerified).toBe(false)
    expect(request.insert).not.toHaveBeenCalled()
  })

  test.each([
    ['pending', false],
    ['approved', true],
    ['rejected', false]
  ])('requires approved affiliation for instructor status %s', async (status, expected) => {
    setAuthenticatedUser('instructor')
    const verification = makeQuery({
      maybeSingle: {
        data: {
          id: 'request-1',
          school_code: '001234',
          status
        },
        error: null
      }
    })
    const institution = makeQuery({
      maybeSingle: {
        data: { school_code: '001234', school_name: 'Example College' },
        error: null
      }
    })
    createClient.mockReturnValue({
      from: jest.fn((table) => ({
        instructor_verification_requests: verification,
        institutions: institution,
        institution_email_domains: makeApprovedDomain()
      }[table]))
    })

    const response = await handleInstructorVerificationStatus(makeContext())
    expect(response.status).toBe(200)
    expect(response.payload.authorizationGranted).toBe(expected)
  })

  test('does not authorize an instructor when the approved affiliation email domain no longer matches', async () => {
    setAuthenticatedUser('instructor', 'verified-user', 'person@gmail.com')
    const verification = makeQuery({
      maybeSingle: {
        data: { school_code: '001234', status: 'approved' },
        error: null
      }
    })
    const institution = makeQuery({
      maybeSingle: {
        data: { school_code: '001234', school_name: 'Example College' },
        error: null
      }
    })
    const noDomainMatch = makeQuery({
      maybeSingle: { data: null, error: null }
    })

    createClient.mockReturnValue({
      from: jest.fn((table) => ({
        instructor_verification_requests: verification,
        institutions: institution,
        institution_email_domains: noDomainMatch
      }[table]))
    })

    const response = await handleInstructorVerificationStatus(makeContext())
    expect(response.status).toBe(200)
    expect(response.payload.institutionalEmailVerified).toBe(false)
    expect(response.payload.authorizationGranted).toBe(false)
  })

  test('does not authorize a student even with an approved affiliation row', async () => {
    setAuthenticatedUser('student')
    const profile = makeQuery({
      maybeSingle: { data: { role: 'student' }, error: null }
    })
    const verification = makeQuery({
      maybeSingle: {
        data: { school_code: '001234', status: 'approved' },
        error: null
      }
    })
    const institution = makeQuery({
      maybeSingle: {
        data: { school_code: '001234', school_name: 'Example College' },
        error: null
      }
    })

    createClient.mockReturnValue({
      from: jest.fn((table) => ({
        profiles: profile,
        instructor_verification_requests: verification,
        institutions: institution,
        institution_email_domains: makeApprovedDomain()
      }[table]))
    })
    const response = await handleInstructorVerificationStatus(makeContext())
    expect(response.status).toBe(200)
    expect(response.payload.authorizationGranted).toBe(false)
    expect(response.payload.role).toBe('student')
  })

  test('allows admin access without an affiliation request', async () => {
    setAuthenticatedUser('admin')
    const verification = makeQuery({
      maybeSingle: { data: null, error: null }
    })

    createClient.mockReturnValue({
      from: jest.fn((table) => ({
        instructor_verification_requests: verification
      }[table]))
    })

    const response = await handleInstructorVerificationStatus(makeContext())
    expect(response.status).toBe(200)
    expect(response.payload.authorizationGranted).toBe(true)
    expect(response.payload.role).toBe('admin')
  })

  test.each(['approved', 'rejected'])(
    'does not overwrite an existing %s review decision',
    async (status) => {
      setAuthenticatedUser('instructor')
      const institution = makeQuery({
        maybeSingle: {
          data: { school_code: '001234', school_name: 'Example College' },
          error: null
        }
      })
      const request = makeQuery({
        maybeSingle: {
          data: { id: 'request-1', school_code: '001234', status },
          error: null
        }
      })
      createClient.mockReturnValue({
        from: jest.fn((table) => ({
          institutions: institution,
          institution_email_domains: makeApprovedDomain(),
          instructor_verification_requests: request
        }[table]))
      })

      const response = await handleInstructorVerificationRequest(
        makeContext({
          method: 'POST',
          body: { schoolCode: '001234' }
        })
      )

      expect(response.status).toBe(409)
      expect(request.insert).not.toHaveBeenCalled()
      expect(response.payload.verification.status).toBe(status)
    }
  )
})
