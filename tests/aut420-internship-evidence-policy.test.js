const { verify } = require('../scripts/verify-aut420-internship-evidence-policy.js')

describe('AUT-420 internship evidence policy', () => {
  test('policy validator passes', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})
