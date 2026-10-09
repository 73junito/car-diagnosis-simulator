const fs = require('fs')
const path = require('path')

describe('curriculum reference freshness review registry', () => {
  const registryPath = path.join(
    __dirname,
    '..',
    'data',
    'curriculum',
    'reference-freshness-reviews.json'
  )
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))

  test('reviews exactly the five sources from the current age screen', () => {
    const ids = registry.reviews.map((review) => review.referenceId).sort()
    expect(ids).toEqual([
      'automotive-engine-diagnostic-survey-2012',
      'nasa-systems-engineering-handbook-2016',
      'nhtsa-fmvss-126-electronic-stability-control',
      'nist-tn1900-measurement-uncertainty',
      'sae-nissan-can-diagnostic-flow-2014'
    ])
    expect(new Set(ids).size).toBe(5)
  })

  test('uses only explicit reviewed dispositions with evidence and usage constraints', () => {
    const allowed = new Set([
      'current-authoritative',
      'current-authoritative-with-companion-update',
      'historical-supporting'
    ])
    for (const review of registry.reviews) {
      expect(allowed.has(review.status)).toBe(true)
      expect(review.evidenceChecked).toBe('2026-10-09')
      expect(review.evidenceUrl).toMatch(/^https:\/\//)
      expect(review.rationale.length).toBeGreaterThan(40)
      expect(review.usageConstraint.length).toBeGreaterThan(40)
    }
  })

  test('keeps historical sources explicitly non-operational', () => {
    const historical = registry.reviews.filter((review) => review.status === 'historical-supporting')
    expect(historical).toHaveLength(2)
    for (const review of historical) {
      expect(review.usageConstraint.toLowerCase()).toMatch(/current|historical|service information/)
    }
  })
})
