const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows')
const APPROVED_IMAGE = 'postgres:14'
// The catalog exercises PostgreSQL 15+ NULLS NOT DISTINCT semantics.
// Permit only this review-only PG17 workflow; all other services remain PG14.
const REVIEW_ONLY_PG17_WORKFLOW = '.github/workflows/obd-catalog-regression.yml'
const FORBIDDEN_ECR_PREFIX = 'public.ecr.aws/docker/library/postgres'

function fail(message) {
  throw new Error(message)
}

function workflowFiles() {
  return fs.readdirSync(WORKFLOWS_DIR)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort()
}

function postgresServiceImages(text) {
  const images = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s{6}postgres:\s*$/.test(lines[i])) continue

    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^\s{6}\S/.test(lines[j])) break
      const imageMatch = lines[j].match(/^\s{8}image:\s*([^\s#]+)\s*$/)
      if (imageMatch) {
        images.push(imageMatch[1])
        break
      }
    }
  }
  return images
}

function verifyCiPostgresServiceImage() {
  const occurrences = []

  for (const name of workflowFiles()) {
    const relative = path.posix.join('.github', 'workflows', name)
    const text = fs.readFileSync(path.join(WORKFLOWS_DIR, name), 'utf8')

    if (text.includes(FORBIDDEN_ECR_PREFIX)) {
      fail(`${relative}: Public ECR Postgres image is forbidden because repeated registry throttling can fail jobs before checkout.`)
    }

    for (const image of postgresServiceImages(text)) {
      if (image !== APPROVED_IMAGE && !(relative === REVIEW_ONLY_PG17_WORKFLOW && image === 'postgres:17')) {
        fail(`${relative}: disposable Postgres service must use ${APPROVED_IMAGE}; found ${image}`)
      }
      occurrences.push({ workflow: relative, image })
    }
  }

  if (occurrences.length === 0) {
    fail('No disposable Postgres service images were found; registry guard is not exercising any workflow.')
  }

  return {
    approvedImage: APPROVED_IMAGE,
    occurrenceCount: occurrences.length,
    occurrences
  }
}

if (require.main === module) {
  const result = verifyCiPostgresServiceImage()
  console.log(
    `CI Postgres service image: PASS (${result.occurrenceCount} explicitly approved services; default ${result.approvedImage}; Public ECR forbidden)`
  )
}

module.exports = {
  APPROVED_IMAGE,
  REVIEW_ONLY_PG17_WORKFLOW,
  FORBIDDEN_ECR_PREFIX,
  postgresServiceImages,
  verifyCiPostgresServiceImage
}
