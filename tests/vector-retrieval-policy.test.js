const fs = require('fs')
const path = require('path')
const { verifyVectorRetrievalPolicy } = require('../scripts/verify-vector-retrieval-policy')

describe('governed vector retrieval readiness', () => {
  test('remains fail-closed until a separately approved vector corpus exists', () => {
    const result = verifyVectorRetrievalPolicy()

    expect(result.status).toBe('disabled-no-approved-vector-corpus')
    expect(result.productionActivationAllowed).toBe(false)
    expect(result.extensionInstalled).toBe(false)
    expect(result.currentEligibleSourceId).toBe('frontiers-automotive-alternator-2023')
    expect(result.currentEligibleChunkCount).toBe(2)
  })

  test('contains no pgvector activation migration or vector index', () => {
    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations')
    const combined = fs.readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8'))
      .join('\n')

    expect(combined).not.toMatch(/create\s+extension[^;]*\bvector\b/i)
    expect(combined).not.toMatch(/\bembedding\s+vector\s*\(/i)
    expect(combined).not.toMatch(/\busing\s+hnsw\b/i)
    expect(combined).not.toMatch(/\busing\s+ivfflat\b/i)
  })
})
