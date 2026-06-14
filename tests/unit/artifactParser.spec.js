const { parseArtifact } = require('../../core/diagnosis/artifactParser');
const AdmZip = require('adm-zip');

const sample = {
  tests: [
    { name: 'auto-open.integration', status: 'fail', duration: 1200, suite: 'integration' }
  ],
  runId: 'run-123',
  repo: 'owner/repo',
  timestamp: 1600000000000
};

test('parseArtifact accepts direct JSON object', async () => {
  const out = await parseArtifact(sample);
  expect(out.tests.length).toBe(1);
  expect(out.tests[0].name).toBe('auto-open.integration');
  expect(out.metadata.runId).toBe('run-123');
});

test('parseArtifact extracts JSON from a buffer containing JSON', async () => {
  const buf = Buffer.from(JSON.stringify(sample), 'utf8');
  const out = await parseArtifact(buf, { runId: 'override' });
  expect(out.tests.length).toBe(1);
  expect(out.tests[0].status).toBe('fail');
  expect(out.metadata.runId).toBe('override');
});
