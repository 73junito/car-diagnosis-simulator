const fs = require('fs')
const path = require('path')
const {
  APPROVED_IMAGE,
  postgresServiceImages,
  verifyCiPostgresServiceImage
} = require('../scripts/verify-ci-postgres-service-image')

describe('CI disposable Postgres registry policy', () => {
  test('all disposable Postgres services use the approved official image', () => {
    const result = verifyCiPostgresServiceImage()

    expect(result.approvedImage).toBe('postgres:14')
    // Exhaustive inventory, not a permission list. Every service-container declaration in the
    // repository is recorded here so that adding one fails this test until it has been reviewed
    // and added deliberately. The list is therefore expected to reach four, and to grow only by
    // explicit review: it never exempts an entry from APPROVED_IMAGE, which is enforced above.
    expect(result.occurrenceCount).toBe(4)
    expect(result.occurrences).toEqual([
      {
        workflow: '.github/workflows/apply-migrations.yml',
        image: 'postgres:14'
      },
      {
        workflow: '.github/workflows/apply-migrations.yml',
        image: 'postgres:14'
      },
      {
        workflow: '.github/workflows/lmf-db-verification.yml',
        image: 'postgres:14'
      },
      {
        workflow: '.github/workflows/provenance-db-integration.yml',
        image: 'postgres:14'
      }
    ])
  })

  test('extracts Postgres service images without matching unrelated image keys', () => {
    const fixture = [
      'jobs:',
      '  test:',
      '    services:',
      '      postgres:',
      '        image: postgres:14',
      '        env:',
      '          POSTGRES_DB: testdb',
      '      redis:',
      '        image: redis:7'
    ].join('\n')

    expect(postgresServiceImages(fixture)).toEqual([APPROVED_IMAGE])
  })

  test('checked-in workflows no longer reference Public ECR Postgres', () => {
    const workflowsDir = path.join(__dirname, '..', '.github', 'workflows')
    const combined = fs.readdirSync(workflowsDir)
      .filter((name) => /\.ya?ml$/i.test(name))
      .map((name) => fs.readFileSync(path.join(workflowsDir, name), 'utf8'))
      .join('\n')

    expect(combined).not.toContain('public.ecr.aws/docker/library/postgres')
  })
})
