'use strict'

const EXPECTED_SOURCE_COUNT = 38

const RESOLVED_SOURCES = {
  'automotive-engine-diagnostic-survey-2012': {
    classification: 'SCHOLARLY_CITATION_PARAPHRASE_ALLOWED_REPRO_STORAGE_AI_COMMERCIAL_RESTRICTED',
    rights: {
      citationLinkAllowed: true,
      paraphraseSummaryAllowed: true,
      directReproductionAllowed: false,
      databaseStorageAllowed: false,
      aiRagIngestionAllowed: false,
      commercialUseAllowed: false
    }
  },
  'scholar-battery-soc-soh-review-2023': {
    classification: 'CC_BY_4_0',
    rights: {
      citationLinkAllowed: true,
      paraphraseSummaryAllowed: true,
      directReproductionAllowed: true,
      databaseStorageAllowed: true,
      aiRagIngestionAllowed: true,
      commercialUseAllowed: true
    }
  },
  'icar-adas-diagnostic-process-2025': {
    classification: 'PROPRIETARY_CITATION_ONLY_REUSE_RESTRICTED_BY_TERMS',
    rights: {
      citationLinkAllowed: true,
      paraphraseSummaryAllowed: false,
      directReproductionAllowed: false,
      databaseStorageAllowed: false,
      aiRagIngestionAllowed: false,
      commercialUseAllowed: false
    }
  },
  'bosch-alternator-technical-poster-2020': {
    classification: 'PROPRIETARY_CITATION_ONLY_REUSE_RESTRICTED_BY_TERMS',
    rights: {
      citationLinkAllowed: true,
      paraphraseSummaryAllowed: false,
      directReproductionAllowed: false,
      databaseStorageAllowed: false,
      aiRagIngestionAllowed: false,
      commercialUseAllowed: false
    }
  },
  'ies-continuous-improvement-education-toolkit-2020': {
    classification: 'US_GOVERNMENT_PUBLIC_DOMAIN_TEXT_WITH_THIRD_PARTY_CAVEAT',
    rights: {
      citationLinkAllowed: true,
      paraphraseSummaryAllowed: true,
      directReproductionAllowed: false,
      databaseStorageAllowed: false,
      aiRagIngestionAllowed: false,
      commercialUseAllowed: true
    }
  },
  'sae-nissan-can-diagnostic-flow-2014': {
    classification: 'SAE_CITATION_PARAPHRASE_ALLOWED_REPRO_STORAGE_AI_PERMISSION_REQUIRED',
    rights: {
      citationLinkAllowed: true,
      paraphraseSummaryAllowed: true,
      directReproductionAllowed: false,
      databaseStorageAllowed: false,
      aiRagIngestionAllowed: false,
      commercialUseAllowed: false
    }
  },
  'gm-pre-post-scan-position-2022': {
    classification: 'OEM_CITATION_ONLY_REUSE_RESTRICTED_BY_TERMS',
    rights: {
      citationLinkAllowed: true,
      paraphraseSummaryAllowed: false,
      directReproductionAllowed: false,
      databaseStorageAllowed: false,
      aiRagIngestionAllowed: false,
      commercialUseAllowed: false
    }
  }
}

function parseArgs(argv) {
  const args = {
    baseUrl: 'https://app.autolearnpro.com'
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--base-url' && argv[i + 1]) args.baseUrl = argv[++i]
    else if (arg === '--help') args.help = true
    else throw new Error(`Unknown or incomplete argument: ${arg}`)
  }
  return args
}

function normalizeSource(source) {
  const rights = source.rights || {}
  return {
    id: source.id,
    classification: source.licenseClassification || source.license_classification,
    rights: {
      citationLinkAllowed: rights.citationLinkAllowed ?? source.citation_link_allowed,
      paraphraseSummaryAllowed: rights.paraphraseSummaryAllowed ?? source.paraphrase_summary_allowed,
      directReproductionAllowed: rights.directReproductionAllowed ?? source.direct_reproduction_allowed,
      databaseStorageAllowed: rights.databaseStorageAllowed ?? source.database_storage_allowed,
      aiRagIngestionAllowed: rights.aiRagIngestionAllowed ?? source.ai_rag_ingestion_allowed,
      commercialUseAllowed: rights.commercialUseAllowed ?? source.commercial_use_allowed
    }
  }
}

function auditRightsClosure(payload) {
  const sources = Array.isArray(payload?.data) ? payload.data.map(normalizeSource) : []
  const failures = []

  if (sources.length !== EXPECTED_SOURCE_COUNT) {
    failures.push(`expected ${EXPECTED_SOURCE_COUNT} sources, found ${sources.length}`)
  }

  const unresolved = sources.filter((source) =>
    String(source.classification || '').includes('REUSE_UNVERIFIED')
  )
  if (unresolved.length > 0) {
    failures.push(`unresolved rights classifications: ${unresolved.map((x) => x.id).join(', ')}`)
  }

  const byId = new Map(sources.map((source) => [source.id, source]))
  for (const [id, expected] of Object.entries(RESOLVED_SOURCES)) {
    const actual = byId.get(id)
    if (!actual) {
      failures.push(`missing resolved source: ${id}`)
      continue
    }

    if (actual.classification !== expected.classification) {
      failures.push(
        `${id}: expected classification ${expected.classification}, found ${actual.classification}`
      )
    }

    for (const [key, expectedValue] of Object.entries(expected.rights)) {
      if (actual.rights[key] !== expectedValue) {
        failures.push(
          `${id}: expected ${key}=${expectedValue}, found ${actual.rights[key]}`
        )
      }
    }
  }

  return {
    ok: failures.length === 0,
    sourceCount: sources.length,
    unresolvedCount: unresolved.length,
    resolvedAuditCount: Object.keys(RESOLVED_SOURCES).length,
    failures
  }
}

async function loadJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response.json()
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`[FAIL] Curriculum source-rights closure audit: ${error.message}`)
    process.exit(1)
  }

  if (args.help) {
    console.log('Usage: node scripts/curriculum-source-rights-closure-audit.js [--base-url URL]')
    return
  }

  const baseUrl = args.baseUrl.replace(/\/$/, '')
  let payload
  try {
    payload = await loadJson(`${baseUrl}/api/curriculum/references`)
  } catch (error) {
    console.error(`[FAIL] Curriculum source-rights closure audit: ${error.message}`)
    process.exit(1)
  }

  const result = auditRightsClosure(payload)
  if (!result.ok) {
    console.error('[FAIL] Curriculum source-rights closure audit')
    for (const failure of result.failures) console.error(`  - ${failure}`)
    process.exit(1)
  }

  console.log(
    `[PASS] Curriculum source-rights closure: ${result.sourceCount} sources, ${result.unresolvedCount} unresolved, ${result.resolvedAuditCount} resolved-source contracts verified`
  )
}

if (require.main === module) {
  main()
}

module.exports = {
  EXPECTED_SOURCE_COUNT,
  RESOLVED_SOURCES,
  auditRightsClosure,
  normalizeSource,
  parseArgs
}
