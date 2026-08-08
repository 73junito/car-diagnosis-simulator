const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'data', 'rala', 'approved-source-manifest.json');
const batchPath = path.join(repoRoot, 'reports', 'rala-pilot-batch.json');
const validatorPath = path.join(repoRoot, 'scripts', 'validate-rala-rights.ps1');
const tempDirs = [];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function normalizeMessage(value) {
  return String(value || '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function runValidator(tempManifestPath, tempBatchPath) {
  try {
    const stdout = execFileSync(
      'pwsh',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        validatorPath,
        '-ManifestPath',
        tempManifestPath,
        '-BatchPath',
        tempBatchPath,
      ],
      {
        cwd: repoRoot,
        stdio: 'pipe',
        encoding: 'utf8',
      }
    );

    const message = String(stdout || '').trim();
    return {
      ok: true,
      rejected: false,
      exitCode: 0,
      message,
      normalizedMessage: normalizeMessage(message),
    };
  } catch (error) {
    const exitCode = Number.isInteger(error.status) ? error.status : null;
    const stdout = typeof error.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error.stderr === 'string' ? error.stderr : '';
    const message = `${stdout}\n${stderr}`.trim();
    return {
      ok: false,
      rejected: true,
      exitCode,
      message,
      normalizedMessage: normalizeMessage(message),
    };
  }
}

function createFixtures(mutator) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rala-rights-validator-'));
  const tempManifestPath = path.join(tempDir, 'manifest.json');
  const tempBatchPath = path.join(tempDir, 'batch.json');

  const manifest = readJson(manifestPath);
  const batch = readJson(batchPath);

  mutator({ manifest, batch });

  writeJson(tempManifestPath, manifest);
  writeJson(tempBatchPath, batch);
  tempDirs.push(tempDir);

  return { tempDir, tempManifestPath, tempBatchPath };
}

function makeRetrievableSource(overrides = {}) {
  return {
    id: 'fixture-approved-source',
    title: 'Fixture Approved Source',
    publisher: 'TorqueMind',
    publication_year: 2026,
    license: { name: 'CC-BY', terms: 'Allowed.' },
    original_filename: 'fixture.txt',
    storage_path: 'https://example.com/fixture',
    checksum: 'fixture-checksum',
    checksum_algorithm: 'sha256',
    language: 'en',
    version: 1,
    status: 'approved',
    notes: 'Fixture source.',
    authors: ['Fixture'],
    ingestion_rights_status: 'unrestricted_ingestion',
    redistribution_status: 'authorized',
    training_use_status: 'authorized',
    rights_basis: 'documented approved ingestion rights',
    rights_reviewed_by: 'reviewer-1',
    rights_review_date: '2026-08-08',
    chunks: [
      {
        chunk_id: 'fixture-approved-chunk',
        title: 'Fixture Chunk',
        section: 'Fixture Section',
        locator: 'Fixture > Section',
        text_excerpt: 'Approved excerpt text',
        token_count: 3,
        text_hash: 'fixture-approved-text-hash',
        language: 'en',
        status: 'approved',
        approved: true,
      },
    ],
    ...overrides,
  };
}

function setSingleRetrievableQuestion(batch, overrides = {}) {
  batch.questions = batch.questions.slice(0, 1).map((question) => ({
    ...question,
    human_review: {
      source_evidence_id: 'fixture-approved-source:fixture-approved-chunk',
      reviewer_name: 'Reviewer 1',
      review_date: '2026-08-08',
      decision: 'approve_with_limitations',
      supporting_rationale: 'Reviewed against approved source.',
      remaining_limitations: 'None for fixture.',
      rights_status_and_permitted_use: 'authorized ingestion',
      evidence_gate_result: 'pass_fixture',
    },
    citations: [
      {
        role: 'supports-answer',
        source_id: 'fixture-approved-source',
        chunk_id: 'fixture-approved-chunk',
        locator: 'Fixture > Section',
        quote: null,
        evidence_summary: 'Fixture approved evidence.',
      },
      {
        role: 'supports-explanation',
        source_id: 'fixture-approved-source',
        chunk_id: 'fixture-approved-chunk',
        locator: 'Fixture > Section',
        quote: null,
        evidence_summary: 'Fixture approved explanation evidence.',
      },
    ],
    ...overrides,
  }));
}

describe('RALA rights validator fail-closed regressions', () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup failures to avoid masking primary assertions.
      }
    }
  });

  test('baseline policy artifacts fail on non-retrievable live pilot citations', () => {
    const result = runValidator(manifestPath, batchPath);
    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.rejected).toBe(true);
    expect(result.normalizedMessage).toMatch(/non-retrievable chunk/i);
  });

  test('valid ingestible citation passes', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      manifest.sources = [makeRetrievableSource()];
      manifest.questions = [];
      batch.rights_review_state = 'not_approved';
      setSingleRetrievableQuestion(batch);
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  test('rejects restricted text_excerpt', () => {
    const fx = createFixtures(({ manifest }) => {
      manifest.sources[0].ingestion_rights_status = 'unknown_blocked';
      manifest.sources[0].chunks[0].text_excerpt = 'Unauthorized test quotation';
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.rejected).toBe(true);
    expect(result.normalizedMessage).toMatch(/text_excerpt/i);
  });

  test('rejects restricted non-null citation quote', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      manifest.sources[0].ingestion_rights_status = 'metadata_and_link_only';
      batch.questions[0].citations[0].quote = 'Unauthorized quote text';
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.rejected).toBe(true);
    expect(result.normalizedMessage).toMatch(/verbatim quote/i);
  });

  test('rejects batch citation to missing source', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      manifest.sources = [makeRetrievableSource()];
      manifest.questions = [];
      batch.rights_review_state = 'not_approved';
      setSingleRetrievableQuestion(batch);
      batch.questions[0].citations[0].source_id = 'missing-source';
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.normalizedMessage).toMatch(/cites unknown source_id/i);
  });

  test('rejects batch citation to missing chunk', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      manifest.sources = [makeRetrievableSource()];
      manifest.questions = [];
      batch.rights_review_state = 'not_approved';
      setSingleRetrievableQuestion(batch);
      batch.questions[0].citations[0].chunk_id = 'missing-chunk';
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.normalizedMessage).toMatch(/cites unknown chunk_id/i);
  });

  test('rejects mismatched source_id and chunk ownership', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      manifest.sources = [
        makeRetrievableSource(),
        makeRetrievableSource({
          id: 'fixture-approved-source-2',
          chunks: [
            {
              chunk_id: 'fixture-approved-chunk-2',
              title: 'Fixture Chunk 2',
              section: 'Fixture Section 2',
              locator: 'Fixture > Section 2',
              text_excerpt: 'Approved excerpt text 2',
              token_count: 4,
              text_hash: 'fixture-approved-text-hash-2',
              language: 'en',
              status: 'approved',
              approved: true,
            },
          ],
        }),
      ];
      manifest.questions = [];
      batch.rights_review_state = 'not_approved';
      setSingleRetrievableQuestion(batch);
      batch.questions[0].citations[0].chunk_id = 'fixture-approved-chunk-2';
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.normalizedMessage).toMatch(/chunk 'fixture-approved-chunk-2' under source 'fixture-approved-source'.*belongs to source 'fixture-approved-source-2'/i);
  });

  test('rejects metadata-only citation presented as retrievable', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      manifest.sources = [makeRetrievableSource({
        ingestion_rights_status: 'metadata_and_link_only',
        redistribution_status: 'prohibited_or_unconfirmed',
        training_use_status: 'not_authorized',
        rights_basis: 'citation_and_metadata_only_pending_review',
        rights_reviewed_by: 'pending',
        rights_review_date: null,
        chunks: [
          {
            chunk_id: 'fixture-approved-chunk',
            title: 'Fixture Chunk',
            section: 'Fixture Section',
            locator: 'Fixture > Section',
            text_excerpt: null,
            token_count: 3,
            text_hash: 'fixture-approved-text-hash',
            language: 'en',
            status: 'draft',
            approved: false,
          },
        ],
      })];
      manifest.questions = [];
      batch.rights_review_state = 'not_approved';
      setSingleRetrievableQuestion(batch);
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.normalizedMessage).toMatch(/cites non-retrievable chunk/i);
  });

  test('rejects license_ok=true while rights review is pending', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      manifest.sources = [makeRetrievableSource()];
      manifest.questions = [];
      batch.rights_review_state = 'not_approved';
      setSingleRetrievableQuestion(batch);
      batch.rights_review_state = 'pending';
      batch.questions[0].validation_checklist.license_ok = true;
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.rejected).toBe(true);
    expect(result.normalizedMessage).toMatch(/license_ok=true/i);
  });

  test('rejects unrestricted_ingestion without documented approval', () => {
    const fx = createFixtures(({ manifest }) => {
      manifest.sources[0].ingestion_rights_status = 'unrestricted_ingestion';
      manifest.sources[0].rights_reviewed_by = 'pending';
      manifest.sources[0].rights_review_date = null;
      manifest.sources[0].training_use_status = 'not_authorized';
      manifest.sources[0].redistribution_status = 'prohibited_or_unconfirmed';
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.rejected).toBe(true);
    expect(result.normalizedMessage).toMatch(/cannot be unrestricted_ingestion/i);
    expect(result.normalizedMessage).toMatch(/documented approval/i);
  });

  test('rejects missing rights status', () => {
    const fx = createFixtures(({ manifest }) => {
      delete manifest.sources[0].ingestion_rights_status;
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.rejected).toBe(true);
    expect(result.normalizedMessage).toMatch(/missing ingestion_rights_status/i);
  });

  test('rejects unknown rights status', () => {
    const fx = createFixtures(({ manifest }) => {
      manifest.sources[0].ingestion_rights_status = 'totally_unknown_status';
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.rejected).toBe(true);
    expect(result.normalizedMessage).toMatch(/invalid ingestion_rights_status/i);
  });

  test('rejects NHTSA metadata-only TSB presented as retrievable', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      manifest.sources = [makeRetrievableSource({
        id: 'nhtsa-tsb-fixture',
        source_class: 'nhtsa_manufacturer_communication',
        storage_path: 'https://static.nhtsa.gov/odi/tsbs/2026/MC-00000001-0001.pdf',
        ingestion_rights_status: 'metadata_and_link_only',
        redistribution_status: 'prohibited_or_unconfirmed',
        training_use_status: 'not_authorized',
        rights_basis: 'citation_and_metadata_only_pending_review',
        rights_reviewed_by: 'pending',
        rights_review_date: null,
        nhtsa_metadata: {
          nhtsa_url: 'https://static.nhtsa.gov/odi/tsbs/2026/MC-00000001-0001.pdf',
          bulletin_number: 'MC-00000001-0001',
          manufacturer: 'Example OEM',
          recall_status: 'not_a_recall',
        },
        chunks: [
          {
            chunk_id: 'nhtsa-tsb-fixture-chunk',
            title: 'Manufacturer communication',
            section: 'Overview',
            locator: 'MC-00000001-0001 > Overview',
            text_excerpt: null,
            token_count: 3,
            text_hash: 'nhtsa-tsb-fixture-hash',
            language: 'en',
            status: 'draft',
            approved: false,
          },
        ],
      })];
      manifest.questions = [];
      batch.rights_review_state = 'not_approved';
      setSingleRetrievableQuestion(batch);
      batch.questions[0].citations = batch.questions[0].citations.map((citation) => ({
        ...citation,
        source_id: 'nhtsa-tsb-fixture',
        chunk_id: 'nhtsa-tsb-fixture-chunk',
      }));
      batch.questions[0].human_review.source_evidence_id = 'nhtsa-tsb-fixture:nhtsa-tsb-fixture-chunk';
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.normalizedMessage).toMatch(/non-retrievable chunk/i);
  });

  test('rejects NHTSA source labeled as recall without explicit evidence', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      manifest.sources = [makeRetrievableSource({
        id: 'nhtsa-tsb-fixture',
        source_class: 'nhtsa_manufacturer_communication',
        storage_path: 'https://static.nhtsa.gov/odi/tsbs/2026/MC-00000001-0001.pdf',
        nhtsa_metadata: {
          nhtsa_url: 'https://static.nhtsa.gov/odi/tsbs/2026/MC-00000001-0001.pdf',
          bulletin_number: 'MC-00000001-0001',
          manufacturer: 'Example OEM',
          recall_status: 'recall',
        },
      })];
      manifest.questions = [];
      batch.rights_review_state = 'not_approved';
      setSingleRetrievableQuestion(batch);
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.normalizedMessage).toMatch(/cannot be labeled as a recall without explicit recall_evidence/i);
  });
});
