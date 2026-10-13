const {
  EXPECTED_SOURCE_COUNT,
  RESOLVED_SOURCES,
  auditRightsClosure,
  normalizeSource,
  parseArgs
} = require('../scripts/curriculum-source-rights-closure-audit.js')

describe('curriculum source-rights closure audit', () => {
  function source(id, classification, rights) {
    return {
      id,
      licenseClassification: classification,
      rights
    }
  }

  function compliantPayload() {
    const required = Object.entries(RESOLVED_SOURCES).map(([id, expected]) =>
      source(id, expected.classification, { ...expected.rights })
    )

    const filler = Array.from(
      { length: EXPECTED_SOURCE_COUNT - required.length },
      (_, index) =>
        source(`source-${index + 1}`, 'CC_BY_4_0', {
          citationLinkAllowed: true,
          paraphraseSummaryAllowed: true,
          directReproductionAllowed: true,
          databaseStorageAllowed: true,
          aiRagIngestionAllowed: true,
          commercialUseAllowed: true
        })
    )

    return { data: [...required, ...filler] }
  }

  test('passes the 38-source closed-rights baseline', () => {
    const result = auditRightsClosure(compliantPayload())
    expect(result).toEqual({
      ok: true,
      sourceCount: 38,
      unresolvedCount: 0,
      resolvedAuditCount: 7,
      failures: []
    })
  })

  test('fails if any effective classification remains reuse-unverified', () => {
    const payload = compliantPayload()
    payload.data[7].licenseClassification = 'PROPRIETARY_CITATION_ONLY_REUSE_UNVERIFIED'
    const result = auditRightsClosure(payload)
    expect(result.ok).toBe(false)
    expect(result.unresolvedCount).toBe(1)
    expect(result.failures.join('\n')).toContain('unresolved rights classifications')
  })

  test('fails if a resolved source permission regresses', () => {
    const payload = compliantPayload()
    const sae = payload.data.find((item) => item.id === 'sae-nissan-can-diagnostic-flow-2014')
    sae.rights.paraphraseSummaryAllowed = false

    const result = auditRightsClosure(payload)
    expect(result.ok).toBe(false)
    expect(result.failures.join('\n')).toContain(
      'sae-nissan-can-diagnostic-flow-2014: expected paraphraseSummaryAllowed=true'
    )
  })

  test('supports snake_case API/database rows', () => {
    const row = normalizeSource({
      id: 'x',
      license_classification: 'CC_BY_4_0',
      citation_link_allowed: true,
      paraphrase_summary_allowed: true,
      direct_reproduction_allowed: true,
      database_storage_allowed: true,
      ai_rag_ingestion_allowed: true,
      commercial_use_allowed: true
    })

    expect(row.classification).toBe('CC_BY_4_0')
    expect(row.rights.aiRagIngestionAllowed).toBe(true)
  })

  test('parses a custom base URL', () => {
    expect(parseArgs(['--base-url', 'https://example.test'])).toEqual({
      baseUrl: 'https://example.test'
    })
    expect(() => parseArgs(['--bogus'])).toThrow('Unknown or incomplete argument')
  })
})
