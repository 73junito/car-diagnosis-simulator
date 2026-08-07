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

    return { ok: true, rejected: false, exitCode: 0, message: String(stdout || '').trim() };
  } catch (error) {
    const exitCode = Number.isInteger(error.status) ? error.status : null;
    const stdout = typeof error.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error.stderr === 'string' ? error.stderr : '';
    return {
      ok: false,
      rejected: true,
      exitCode,
      message: `${stdout}\n${stderr}`.trim(),
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

  test('baseline policy artifacts pass', () => {
    const result = runValidator(manifestPath, batchPath);
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.rejected).toBe(false);
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
    expect(result.message).toMatch(/text_excerpt/i);
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
    expect(result.message).toMatch(/verbatim quote/i);
  });

  test('rejects license_ok=true while rights review is pending', () => {
    const fx = createFixtures(({ batch }) => {
      batch.rights_review_state = 'pending';
      batch.questions[0].validation_checklist.license_ok = true;
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.rejected).toBe(true);
    expect(result.message).toMatch(/license_ok=true/i);
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
    expect(result.message).toMatch(/cannot be unrestricted_ingestion/i);
    expect(result.message).toMatch(/documented approval/i);
  });

  test('rejects missing rights status', () => {
    const fx = createFixtures(({ manifest }) => {
      delete manifest.sources[0].ingestion_rights_status;
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.rejected).toBe(true);
    expect(result.message).toMatch(/missing ingestion_rights_status/i);
  });

  test('rejects unknown rights status', () => {
    const fx = createFixtures(({ manifest }) => {
      manifest.sources[0].ingestion_rights_status = 'totally_unknown_status';
    });

    const result = runValidator(fx.tempManifestPath, fx.tempBatchPath);
    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.rejected).toBe(true);
    expect(result.message).toMatch(/invalid ingestion_rights_status/i);
  });
});
