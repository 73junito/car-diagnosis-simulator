const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const read = (relative) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, ''))

function fail(message) {
  throw new Error(message)
}

function walkFiles(dir, suffix) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkFiles(full, suffix))
    else if (!suffix || entry.name.endsWith(suffix)) out.push(full)
  }
  return out
}

function verifyVectorRetrievalPolicy() {
  const policy = read('data/architecture/vector-retrieval-policy.json')

  if (policy.status !== 'disabled-no-approved-vector-corpus') {
    fail('Vector retrieval must remain disabled until a separately approved vector corpus exists.')
  }
  if (policy.productionActivationAllowed !== false) {
    fail('Production vector retrieval activation must remain false.')
  }
  if (policy.extension?.installed !== false) {
    fail('Policy must reflect that pgvector is not installed.')
  }
  if (policy.storage?.embeddingsTableExists !== false || policy.storage?.vectorIndexExists !== false) {
    fail('Vector storage/index must remain absent during readiness phase.')
  }

  const eligibility = policy.sourceEligibility || {}
  for (const key of [
    'databaseStorageAllowedRequired',
    'aiRagIngestionAllowedRequired',
    'currentHumanRightsReviewRequired',
    'expiredRightsRejected',
    'referenceOnlySourcesRejected',
    'unverifiedLocalReferenceRejected'
  ]) {
    if (eligibility[key] !== true) fail(`Vector source eligibility gate drift: ${key}`)
  }

  const restrictions = policy.explicitRestrictions || []
  const openStax = restrictions.find((rule) => /openstax/i.test(rule.pattern || ''))
  if (!openStax || openStax.vectorIngestionAllowed !== false) {
    fail('OpenStax must remain explicitly blocked from vector ingestion.')
  }

  const migrations = walkFiles(path.join(ROOT, 'supabase', 'migrations'), '.sql')
  const forbidden = [
    /create\s+extension[^;]*\bvector\b/i,
    /\bembedding\s+vector\s*\(/i,
    /\busing\s+hnsw\b/i,
    /\busing\s+ivfflat\b/i
  ]
  for (const file of migrations) {
    const text = fs.readFileSync(file, 'utf8')
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        fail(`Vector activation DDL exists before governance approval: ${path.relative(ROOT, file)}`)
      }
    }
  }

  const rightsMigration = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20260929222509_add_approved_source_rights_scopes.sql'),
    'utf8'
  )
  if (!rightsMigration.includes('database_storage_allowed boolean not null default false')) {
    fail('Fail-closed database storage rights gate is missing.')
  }
  if (!rightsMigration.includes('ai_rag_ingestion_allowed boolean not null default false')) {
    fail('Fail-closed AI/RAG rights gate is missing.')
  }

  const frontiersAuthorization = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20260930000435_authorize_frontiers_ai_rag.sql'),
    'utf8'
  )
  if (!frontiersAuthorization.includes("source.id = 'frontiers-automotive-alternator-2023'")) {
    fail('Current explicitly reviewed AI/RAG source authorization is missing.')
  }
  if (!frontiersAuthorization.includes('ai_rag_ingestion_allowed = true')) {
    fail('Current reviewed source AI/RAG authorization is missing.')
  }

  const openStaxMappings = walkFiles(path.join(ROOT, 'supabase', 'migrations'), '.sql')
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n')
  if (!/openstax[\s\S]{0,500}no-AI\/RAG/i.test(openStaxMappings) &&
      !/openstax[\s\S]{0,500}noncommercial and no-AI\/RAG/i.test(openStaxMappings)) {
    fail('OpenStax reference-only/no-AI-RAG guard evidence is missing.')
  }

  for (const value of Object.values(policy.authority || {})) {
    if (value !== 'external-human-governance-only') {
      fail('Vector policy authority boundary drift.')
    }
  }

  return {
    status: policy.status,
    productionActivationAllowed: policy.productionActivationAllowed,
    extensionInstalled: policy.extension.installed,
    approvedVectorCorpusExists: !policy.storage.approvedCorpusManifestRequired,
    currentEligibleSourceId: policy.currentEligibleSourceEvidence.sourceId,
    currentEligibleChunkCount: policy.currentEligibleSourceEvidence.approvedChunkCountObserved
  }
}

if (require.main === module) {
  const result = verifyVectorRetrievalPolicy()
  console.log(
    `Vector retrieval policy: PASS (status=${result.status}; extension installed=${result.extensionInstalled}; production activation=${result.productionActivationAllowed}; eligible source evidence=${result.currentEligibleSourceId}/${result.currentEligibleChunkCount} chunks)`
  )
}

module.exports = { verifyVectorRetrievalPolicy }
