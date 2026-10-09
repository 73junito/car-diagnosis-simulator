/** @jest-environment node */
import fs from 'fs'
import path from 'path'

describe('Semantic Scholar instructor research UI', () => {
  const html = fs.readFileSync(path.resolve('dashboard/instructor/research/index.html'), 'utf8')
  const js = fs.readFileSync(path.resolve('dashboard/instructor/research/research.js'), 'utf8')

  test('requires the authenticated API path rather than calling Semantic Scholar from the browser', () => {
    expect(html).toContain('/auth.js')
    expect(js).toContain('window.getAccessToken')
    expect(js).toContain("Authorization: 'Bearer ' + token")
    expect(js).toContain('/api/research/semantic-scholar/search?')
    expect(js).not.toContain('api.semanticscholar.org')
    expect(html).not.toContain('SEMANTIC_SCHOLAR_API_KEY')
    expect(js).not.toContain('SEMANTIC_SCHOLAR_API_KEY')
  })

  test('shows provenance and scored-assessment boundaries to instructors', () => {
    expect(html).toContain('unreviewed discovery metadata')
    expect(html).toContain('do not automatically become approved curriculum evidence')
    expect(html).toContain('do not create scored-assessment eligibility')
    expect(js).toContain('human provenance review required before curriculum use')
    expect(js).toContain('no scored-assessment eligibility')
  })

  test('renders bibliographic metadata without unsafe HTML injection', () => {
    expect(js).toContain('document.createElement')
    expect(js).toContain('textContent')
    expect(js).not.toContain('innerHTML')
    expect(js).toContain('paper.externalIds.DOI')
    expect(js).toContain('paper.abstract')
  })

  test('supports evidence-gap creation from canonical curriculum lessons', () => {
    expect(html).toContain('id="research-gap-form"')
    expect(html).toContain('id="research-lesson"')
    expect(html).toContain('Create evidence gap')
    expect(js).toContain("fetch('/api/curriculum'")
    expect(js).toContain("apiRequest('/api/research/curriculum-evidence/gaps'")
    expect(js).toContain('lessonPlanId: lessonSelect.value')
    expect(js).toContain('gapSummary: gapSummaryInput.value.trim()')
  })

  test('saves Semantic Scholar results only as unreviewed evidence tied to an active gap', () => {
    expect(js).toContain("apiRequest('/api/research/curriculum-evidence/records'")
    expect(js).toContain('gapId: activeGap.id')
    expect(js).toContain('providerRecordId: paper.paperId')
    expect(js).toContain('Save as Curriculum Evidence')
    expect(js).toContain('Human review and license verification are still required.')
    expect(js).not.toContain('scoredAssessmentEligible: true')
  })

  test('includes Semantic Scholar name, official logo, and API attribution links', () => {
    expect(html).toContain('Semantic Scholar')
    expect(html).toContain('Allen Institute for AI')
    expect(html).toContain('https://www.semanticscholar.org/?utm_source=api')
    expect(html).toContain('./semantic-scholar-logo.svg')
    expect(html).toContain('alt="Semantic Scholar"')
    expect(js).toContain("url.searchParams.set('utm_source', 'api')")
    expect(js).toContain('semanticScholarPublicUrl(paper.url)')
  })
})
