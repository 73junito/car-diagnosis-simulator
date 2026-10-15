'use strict';

const fs = require('fs');
const path = require('path');
const { verifyCatalogEvidenceInventory, REQUIRED_FALSE } = require('../scripts/verify-catalog-evidence-inventory');

const root = path.resolve(__dirname, '..');
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'catalog-evidence', 'inventory.json'), 'utf8'));

describe('local catalog evidence inventory', () => {
  test('governance validator passes without requiring local PDFs', () => {
    const result = verifyCatalogEvidenceInventory({ sourceDir: null });
    expect(result.errors).toEqual([]);
    expect(result.count).toBe(29);
  });

  test('contains 29 unique hashed PDF candidates', () => {
    expect(inventory.sources).toHaveLength(29);
    expect(new Set(inventory.sources.map((s) => s.sourceId)).size).toBe(29);
    expect(new Set(inventory.sources.map((s) => s.filename.toLowerCase())).size).toBe(29);
    expect(new Set(inventory.sources.map((s) => s.artifactSha256)).size).toBe(29);
    for (const source of inventory.sources) {
      expect(source.filename.toLowerCase().endsWith('.pdf')).toBe(true);
      expect(source.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.sizeBytes).toBeGreaterThan(0);
    }
  });

  test('every source remains rights-unreviewed and non-ingestible', () => {
    for (const source of inventory.sources) {
      expect(source.rightsStatus).toBe('unverified-local-reference');
      expect(source.reviewState).toBe('metadata-triaged-rights-unreviewed');
      for (const key of REQUIRED_FALSE) expect(source[key]).toBe(false);
    }
  });

  test('candidate uses are explicitly not permissions', () => {
    expect(inventory.authority.candidateUsesArePermissions).toBe(false);
    expect(inventory.authority.metadataDoesNotApproveRights).toBe(true);
    expect(inventory.authority.metadataDoesNotAuthorizeAssetCopying).toBe(true);
    expect(inventory.authority.metadataDoesNotAuthorizeEngineeringValues).toBe(true);
  });

  test('inventory has no engineering, publication, or assessment authority', () => {
    expect(inventory.authority.engineeringAuthority).toBe('none');
    expect(inventory.authority.publicationAuthority).toBe('none');
    expect(inventory.authority.assessmentAuthority).toBe('none');
  });

  test('high-value lab domains are represented', () => {
    const domains = new Set(inventory.sources.flatMap((s) => s.domainCandidates));
    for (const expected of ['brake-systems','engine-mechanical','engine-performance','drivetrain','steering-suspension-alignment','emissions','automatic-transmission','electrical-electronics']) {
      expect(domains.has(expected)).toBe(true);
    }
  });

  test('vehicle-specific installation manuals are not asset-copying candidates', () => {
    const manuals = inventory.sources.filter((s) => s.specificity === 'vehicle-specific-installation-manual');
    expect(manuals.length).toBeGreaterThan(0);
    for (const source of manuals) {
      expect(source.assetGeometryCopyingAllowed).toBe(false);
      expect(source.publicationAllowed).toBe(false);
      expect(source.candidateUses).not.toContain('generic-asset-planning');
    }
  });

  test('PDF bytes are not stored in the repository inventory directory', () => {
    const dir = path.join(root, 'catalog-evidence');
    const pdfs = fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.pdf'));
    expect(pdfs).toEqual([]);
    expect(inventory.collection.sourceFilesCommitted).toBe(false);
  });
});
