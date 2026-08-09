const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(repoRoot, 'scripts', 'rala-pilot-ingestion.ps1');
const inventoryPath = path.join(repoRoot, 'reports', 'rala-question-inventory.csv');
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
    .replace(/\s+/g, ' ')
    .trim();
}

function runIngestion({ manifestPath, batchPath, outputPath }) {
  try {
    const stdout = execFileSync(
      'pwsh',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-InventoryCsvPath',
        inventoryPath,
        '-ManifestPath',
        manifestPath,
        '-PilotBatchPath',
        batchPath,
        '-OutputSqlPath',
        outputPath,
      ],
      {
        cwd: repoRoot,
        stdio: 'pipe',
        encoding: 'utf8',
      }
    );

    return {
      ok: true,
      exitCode: 0,
      stdout: String(stdout || ''),
      normalizedMessage: normalizeMessage(stdout),
    };
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error.stderr === 'string' ? error.stderr : '';
    return {
      ok: false,
      exitCode: Number.isInteger(error.status) ? error.status : null,
      stdout,
      stderr,
      normalizedMessage: normalizeMessage(`${stdout}\n${stderr}`),
    };
  }
}

function createFixtures(mutator) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rala-pilot-ingestion-'));
  const manifest = readJson(path.join(repoRoot, 'data', 'rala', 'approved-source-manifest.json'));
  const batch = readJson(path.join(repoRoot, 'reports', 'rala-pilot-batch.json'));
  const manifestPath = path.join(tempDir, 'manifest.json');
  const batchPath = path.join(tempDir, 'batch.json');
  const outputPath = path.join(tempDir, 'preview.sql');

  mutator({ manifest, batch });

  writeJson(manifestPath, manifest);
  writeJson(batchPath, batch);
  tempDirs.push(tempDir);

  return { manifestPath, batchPath, outputPath };
}

describe('RALA pilot ingestion preview', () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup failures so assertions remain primary.
      }
    }
  });

  test('approved excerpt with ingestion rights generates chunk SQL', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      manifest.sources = [
        {
          id: 'fixture-approved-source',
          title: 'Fixture Approved Source',
          publisher: 'TorqueMind',
          publication_year: 2026,
          license: { name: 'CC-BY', terms: 'Allowed.' },
          original_filename: 'fixture.txt',
          storage_path: 'https://example.com/fixture',
          checksum: 'abc123',
          checksum_algorithm: 'sha256',
          language: 'en',
          version: 1,
          notes: 'Fixture source.',
          ingestion_rights_status: 'unrestricted_ingestion',
          rights_basis: 'documented approved ingestion rights',
          training_use_status: 'authorized',
          redistribution_status: 'authorized',
          rights_reviewed_by: 'reviewer-1',
          rights_review_date: '2026-08-08',
          authors: ['Fixture'],
          chunks: [
            {
              chunk_id: 'fixture-approved-chunk',
              title: 'Fixture Chunk',
              section: 'sec',
              locator: 'Fixture > sec',
              text_excerpt: 'Approved excerpt text',
              token_count: 3,
              overlap_before_tokens: 0,
              overlap_after_tokens: 0,
              text_hash: 'hash-fixture-approved-chunk',
              language: 'en',
              status: 'draft',
              approved: false,
            },
          ],
        },
      ];

      batch.questions = batch.questions.map((question, index) => ({
        ...question,
        citations: index === 0
          ? [
              {
                role: 'supports-answer',
                source_id: 'fixture-approved-source',
                chunk_id: 'fixture-approved-chunk',
                locator: 'Fixture > sec',
                quote: null,
              },
              {
                role: 'supports-explanation',
                source_id: 'fixture-approved-source',
                chunk_id: 'fixture-approved-chunk',
                locator: 'Fixture > sec',
                quote: null,
              },
            ]
          : [],
      }));
    });

    const result = runIngestion(fx);
    expect(result.ok).toBe(true);
    const sql = fs.readFileSync(fx.outputPath, 'utf8');
    expect(sql).toMatch(/insert into public\.source_chunks/i);
    expect(sql).toMatch(/fixture-approved-chunk/);
  });

  test('metadata/link-only source with null excerpt is omitted and documented', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      batch.questions = batch.questions.map((question) => ({
        ...question,
        citations: [],
      }));

      manifest.sources = manifest.sources.map((source) => ({
        ...source,
        chunks: source.chunks.map((chunk) => ({
          ...chunk,
          text_hash: chunk.text_hash || `hash-${chunk.chunk_id}`,
        })),
      }));

      batch.questions = batch.questions.map((question) => ({
        ...question,
        citations: [],
      }));
    });

    const result = runIngestion(fx);
    expect(result.ok).toBe(true);
    const sql = fs.readFileSync(fx.outputPath, 'utf8');
    expect(sql).toMatch(/Omitted non-retrievable chunk insert for source_id=css_electronics_can_intro/i);
    expect(sql).not.toMatch(/insert into public\.source_chunks[\s\S]*css_electronics_can_intro/i);
  });

  test('null excerpt without restrictive rights fails', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      const source = manifest.sources[0];
      source.ingestion_rights_status = 'unrestricted_ingestion';
      source.rights_basis = 'documented approved ingestion rights';
      source.training_use_status = 'authorized';
      source.redistribution_status = 'authorized';
      source.rights_reviewed_by = 'reviewer-1';
      source.rights_review_date = '2026-08-08';

      batch.questions = batch.questions.map((question) => ({
        ...question,
        citations: [],
      }));
    });

    const result = runIngestion(fx);
    expect(result.ok).toBe(false);
    expect(result.normalizedMessage).toMatch(/missing text_excerpt/i);
  });

  test('restricted source referenced as ingestible fails closed', () => {
    const fx = createFixtures(({ manifest, batch }) => {
      batch.questions = batch.questions.map((question) => ({
        ...question,
        citations: [],
      }));

      manifest.sources = [manifest.sources[0]];
      manifest.sources[0].ingestion_rights_status = 'metadata_and_link_only';
      manifest.sources[0].rights_basis = 'citation_and_metadata_only_pending_review';
      manifest.sources[0].chunks[0].text_excerpt = null;

      batch.questions[0].citations = [
        {
          role: 'supports-answer',
          source_id: manifest.sources[0].id,
          chunk_id: manifest.sources[0].chunks[0].chunk_id,
          locator: manifest.sources[0].chunks[0].locator,
          quote: null,
        },
      ];
    });

    const result = runIngestion(fx);
    expect(result.ok).toBe(false);
    expect(result.normalizedMessage).toMatch(/non-retrievable chunk/i);
    expect(result.normalizedMessage).toMatch(/metadata\/link-only chunks/i);
    expect(result.normalizedMessage).toMatch(/retrievable citations/i);
  });
});