const fs = require('fs')
const path = require('path')
const {
  APPROVED_IMAGE,
  APPROVED_SUPABASE_IMAGE_DIGEST,
  postgresServiceImages,
  supabaseImageReferences,
  verifyApprovedSupabaseImage,
  verifyCiPostgresServiceImage
} = require('../scripts/verify-ci-postgres-service-image')
const { APPROVED_SUPABASE_IMAGE } = require('../scripts/lib/disposable-migration-container')

describe('CI disposable Postgres registry policy', () => {
  test('all disposable Postgres services use the approved official image', () => {
    const result = verifyCiPostgresServiceImage()

    expect(result.approvedImage).toBe('postgres:14')
    // The migration-validation job no longer declares a service: it runs the
    // canonical chain inside the digest-pinned Supabase container instead, so
    // the remaining services are the test job here and the provenance job.
    expect(result.occurrenceCount).toBe(2)
    expect(result.occurrences).toEqual([
      {
        workflow: '.github/workflows/apply-migrations.yml',
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

describe('CI Supabase Postgres image digest policy', () => {
  test('every Supabase Postgres reference in the workflows is digest-pinned', () => {
    const result = verifyApprovedSupabaseImage()

    expect(result.approvedDigest).toBe(APPROVED_SUPABASE_IMAGE_DIGEST)
    expect(result.occurrenceCount).toBeGreaterThan(0)

    for (const occurrence of result.occurrences) {
      expect(occurrence.reference).toContain(APPROVED_SUPABASE_IMAGE_DIGEST)
    }
  })

  test('detects a Supabase Postgres reference that is only tag-pinned', () => {
    const unpinned = '  ghcr.io/supabase/postgres:17.6.1.167'
    const references = supabaseImageReferences(unpinned)

    expect(references).toHaveLength(1)
    expect(references[0]).not.toContain(APPROVED_SUPABASE_IMAGE_DIGEST)
  })

  test('the disposable migration validator uses the reviewed digest image', () => {
    expect(APPROVED_SUPABASE_IMAGE).toBe(
      `ghcr.io/supabase/postgres:17.6.1.167@${APPROVED_SUPABASE_IMAGE_DIGEST}`
    )
    expect(APPROVED_SUPABASE_IMAGE).toContain(APPROVED_SUPABASE_IMAGE_DIGEST)
  })
})
