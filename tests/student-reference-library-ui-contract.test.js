import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const page = fs.readFileSync(
  path.join(root, 'dashboard/student/reference-library/index.html'),
  'utf8'
)

describe('student reference library UI contract', () => {
  test('builds a three-panel discovery surface on the canonical token stack', () => {
    // Filters / results / details panels.
    expect(page).toContain('id="refSearch"');
    expect(page).toContain('id="refSubjectFacets"');
    expect(page).toContain('id="refKindFacets"');
    expect(page).toContain('id="refResults"');
    expect(page).toContain('id="refDetail"');

    // Uses the canonical light token stack and NOT the legacy theme.css monolith.
    expect(page).toContain('href="/theme/tokens.css"');
    expect(page).toContain('href="/theme/layout.css"');
    expect(page).not.toContain('href="/theme.css"');
  })

  test('consumes the existing read-only contract without new endpoints', () => {
    expect(page).toContain("fetch('/api/curriculum/references'");
    expect(page).toContain("fetch('/api/curriculum'");
    // No fabricated endpoints or server search parameter.
    expect(page).not.toMatch(/\/api\/curriculum\/references\?[^"']*q=/);
  })

  test('reuses the learning-path rights-label logic verbatim', () => {
    expect(page).toContain('Reusable with attribution under the recorded license.');
    expect(page).toContain(
      'Reference only: citation/linking permitted; platform AI ingestion, direct reproduction, and commercial reuse are disabled.'
    );
    expect(page).toContain('aiRagIngestionAllowed');
    expect(page).toContain('commercialUseAllowed');
    expect(page).toContain('directReproductionAllowed');
  })

  test('never exposes withheld governance fields or internal sources', () => {
    expect(page).not.toContain('rights_basis');
    expect(page).not.toContain('local_filename');
    expect(page).not.toContain('sae-reuse-guidance-2026');
  })

  test('does not imply verification status or revision history that the schema lacks', () => {
    // status is a visibility enum, not a verification/attestation state.
    expect(page).not.toContain('Verified');
    // No revision/version-history table exists; do not surface one.
    expect(page).not.toContain('Revision history');
    expect(page).not.toContain('Last updated');
  })

  test('labels the academic-subject facet, not a vehicle-system facet', () => {
    expect(page).toContain('Academic subject');
    expect(page).not.toContain('Vehicle system');
  })

  test('handles loading, empty, filtered-empty, and error states', () => {
    expect(page).toContain('Loading references');
    expect(page).toContain('No supplemental references are mapped yet.');
    expect(page).toContain('No references match your filters.');
    expect(page).toContain('Reference services are unavailable.');
    expect(page).toContain('Try again');
  })

  test('addresses keyboard, focus, and responsive behavior', () => {
    // Focus management on selection and on returning from the detail view.
    expect(page).toContain('detailHeadingEl.focus()');
    expect(page).toContain("layout.classList.add('is-detail')");
    expect(page).toContain("layout.classList.remove('is-detail')");
    // Visible focus styling lives in the stylesheet.
    const css = fs.readFileSync(
      path.join(root, 'dashboard/student/reference-library/reference-library.css'),
      'utf8'
    );
    expect(css).toContain(':focus-visible');
    expect(css).toMatch(/@media \(max-width: 1024px\)/);
  })
})
