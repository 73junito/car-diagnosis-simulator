const fs = require('fs');
const path = require('path');
const {
  validateRemediation,
  formatSummary
} = require('../scripts/validate-charging-system-artifact-capture-remediation');

describe('charging-system artifact-capture remediation contract', () => {
  const root = path.resolve(__dirname, '..');
  const remediation = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'evidence', 'review-queues',
      'charging-system-artifact-capture-remediation-20261003.json'),
    'utf8'
  ));
  const inventory = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'evidence', 'review-queues',
      'charging-system-artifact-capture-inventory-20261003.json'),
    'utf8'
  ));

  test('passes the fail-closed remediation validator', () => {
    const { errors } = validateRemediation();
    expect(errors).toEqual([]);
  });

  test('covers every inventory candidate with recorded attempts and a resolution', () => {
    expect(remediation.stage).toBe('capture-remediation-complete-pending-human-rights-review');
    expect(remediation.candidates.map((row) => row.candidate_id).sort())
      .toEqual(inventory.artifacts.map((row) => row.candidate_id).sort());

    for (const row of remediation.candidates) {
      expect(row.objective.length).toBeGreaterThan(0);
      expect(row.attempts.length).toBeGreaterThan(0);
      expect(row.resolution.stability.length).toBeGreaterThan(0);
      expect(row.resolution.note.length).toBeGreaterThan(0);
      for (const attempt of row.attempts) {
        expect(attempt.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(attempt.outcome.length).toBeGreaterThan(0);
        if (attempt.url !== null) expect(attempt.url).toMatch(/^https:\/\//);
      }
      if (row.resolution.status === 'stable-artifact-of-record') {
        expect(row.resolution.artifact_of_record_sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(row.resolution.artifact_of_record_byte_length).toBeGreaterThan(0);
      } else {
        expect(row.resolution.artifact_of_record_sha256).toBeNull();
      }
    }
  });

  test('leaves blocked and unstable candidates unresolved rather than substituting artifacts', () => {
    const stable = remediation.candidates.filter((row) => row.resolution.status === 'stable-artifact-of-record');
    expect(stable).toHaveLength(4);

    const navy = remediation.candidates.find((row) => row.candidate_id === 'navy-navedtra-14264a-ch8');
    expect(navy.resolution.status).toBe('unavailable-access-blocked');
    expect(navy.attempts.length).toBeGreaterThanOrEqual(4);
    expect(navy.attempts.every((attempt) => attempt.outcome !== 'export-captured')).toBe(true);

    const coalinga = remediation.candidates.find(
      (row) => row.candidate_id === 'coalinga-tractor-electrical-hydraulic-health-2026'
    );
    expect(coalinga.resolution.status).toBe('unstable-no-stable-export');

    expect(remediation.unresolved.map((row) => row.candidate_id).sort())
      .toEqual(['coalinga-tractor-electrical-hydraulic-health-2026', 'navy-navedtra-14264a-ch8']);
  });

  test('records no rights-decision, mapping, or review field in the remediation artifact', () => {
    const walk = (value) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === 'object') {
        for (const [key, nested] of Object.entries(value)) {
          expect(key).not.toMatch(/claim|draft|question_id|mapping|technical|instructional|approv|eligib|rights_decision|reviewer_identity/i);
          walk(nested);
        }
      }
    };
    walk(remediation);

    const output = formatSummary(remediation.summary);
    expect(output).toContain('candidates_attempted: 6');
    expect(output).toContain('stable_artifact_of_record: 4');
  });
});