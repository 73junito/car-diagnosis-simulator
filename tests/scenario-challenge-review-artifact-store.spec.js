const fs = require('fs');
const path = require('path');

describe('scenario challenge review artifact storage contract', () => {
  const migration = fs.readFileSync(
    path.resolve(
      __dirname,
      '..',
      'supabase',
      'migrations',
      '20261003023000_add_scenario_challenge_review_artifacts.sql'
    ),
    'utf8'
  ).toLowerCase();

  test('creates an exact-payload review-only table with immutable provenance fields', () => {
    expect(migration).toContain('create table if not exists public.scenario_challenge_review_artifacts');
    expect(migration).toContain('batch_id integer not null unique');
    expect(migration).toContain('workflow_run_id bigint not null unique');
    expect(migration).toContain('workflow_artifact_id bigint not null unique');
    expect(migration).toContain("workflow_artifact_digest ~ '^sha256:[0-9a-f]{64}$'");
    expect(migration).toContain("payload_sha256 ~ '^[0-9a-f]{64}$'");
    expect(migration).toContain("source_commit ~ '^[0-9a-f]{40}$'");
    expect(migration).toContain('question_count integer not null check (question_count = 50)');
    expect(migration).toContain("status = 'synthetic-draft-review-only'");
    expect(migration).toContain('payload_text text not null');
    expect(migration).toContain('stored as text so payload_sha256 can verify the original representation');
  });

  test('is service-role only and fail-closed to browser roles', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain(
      'revoke all on table public.scenario_challenge_review_artifacts\n    from public, anon, authenticated, service_role'
    );
    expect(migration).toContain(
      'grant select, insert on table public.scenario_challenge_review_artifacts\n    to service_role'
    );
    expect(migration).not.toContain('grant all on table public.scenario_challenge_review_artifacts');
    expect(migration).not.toContain('create policy');
    expect(migration).not.toContain('grant select');
  });

  test('documents that storage does not grant question eligibility', () => {
    expect(migration).toContain('do not grant training, scoring, assessment, citation, evidence, or approval eligibility');
    expect(migration).toContain('never expose through browser/client apis');
  });
});
