const fs = require('fs');
const os = require('os');
const path = require('path');

const AIOrchestrator = require('../src/ai/runtime/ai-orchestrator');
const GovernanceRuntime = require('../src/ai/runtime/governance-runtime');
const HumanGateController = require('../src/ai/runtime/human-gate-controller');
const FileRunStore = require('../src/ai/governance/file-run-store');
const recoveryPolicy = require('../data/architecture/agent-orchestration-recovery-policy.json');

function makeStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'torquemind-orchestration-'));
  return {
    directory,
    store: new FileRunStore({ directory }),
  };
}

describe('Phase 4 persistent orchestration state and recovery', () => {
  const directories = [];

  test('recovery policy preserves fail-closed authority boundaries', () => {
    expect(recoveryPolicy.source_of_truth).toBe('append-only-run-ledger');
    expect(recoveryPolicy.checkpoint_recovery.ledger_wins_on_conflict).toBe(true);
    expect(recoveryPolicy.storage_profile.production_durability_claimed).toBe(false);
    expect(recoveryPolicy.authority_invariants).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/do not create production assessment API eligibility/i),
        expect.stringMatching(/Human approval remains separately recorded evidence/i),
      ])
    );
  });

  afterEach(() => {
    while (directories.length) {
      fs.rmSync(directories.pop(), { recursive: true, force: true });
    }
  });

  test('recovers an interrupted governed step after restart', () => {
    const fixture = makeStore();
    directories.push(fixture.directory);

    const runtime1 = new GovernanceRuntime({ store: fixture.store });
    runtime1.recordStart({
      runId: 'restart-run',
      agentId: 'question-agent',
      capability: 'question-drafting',
      from: 'final_content_approved',
      to: 'item_generated',
      requestId: 'request-restart-1',
    });

    const runtime2 = new GovernanceRuntime({
      store: new FileRunStore({ directory: fixture.directory }),
    });

    expect(runtime2.recoverRun('restart-run')).toMatchObject({
      state: 'final_content_approved',
      action: 'step-started',
      status: 'interrupted',
      resumable: true,
    });
  });

  test('retrying the same request after restart is idempotent', async () => {
    const fixture = makeStore();
    directories.push(fixture.directory);

    const runtime1 = new GovernanceRuntime({ store: fixture.store });
    runtime1.recordStart({
      runId: 'resume-run',
      agentId: 'question-agent',
      capability: 'question-drafting',
      from: 'final_content_approved',
      to: 'item_generated',
      requestId: 'request-resume-1',
    });

    const runtime2 = new GovernanceRuntime({
      store: new FileRunStore({ directory: fixture.directory }),
    });
    const orchestrator = new AIOrchestrator({ governanceRuntime: runtime2 });

    orchestrator.registerAgent({
      id: 'question-agent',
      capabilities: ['question-drafting'],
      execute: async () => ({ done: true }),
    });

    orchestrator.submit({
      id: 'request-resume-1',
      capability: 'question-drafting',
      governed: {
        runId: 'resume-run',
        from: 'final_content_approved',
        to: 'item_generated',
      },
    });
    await orchestrator.drain();

    const ledger = orchestrator.getRunLedger('resume-run');
    expect(ledger.filter((entry) => entry.action === 'step-started')).toHaveLength(1);
    expect(ledger.filter((entry) => entry.action === 'step-finished')).toHaveLength(1);
    expect(orchestrator.recoverGovernedRun('resume-run')).toMatchObject({
      state: 'item_generated',
      status: 'step-completed',
    });
  });

  test('recovery repairs a stale checkpoint from the durable ledger', () => {
    const fixture = makeStore();
    directories.push(fixture.directory);

    const runtime1 = new GovernanceRuntime({ store: fixture.store });
    runtime1.recordStart({
      runId: 'repair-run',
      agentId: 'question-agent',
      capability: 'question-drafting',
      from: 'final_content_approved',
      to: 'item_generated',
      requestId: 'repair-request',
    });

    fixture.store.writeCheckpoint('repair-run', {
      runId: 'repair-run',
      state: 'drafted',
      action: 'stale',
      status: 'stale',
    });

    const runtime2 = new GovernanceRuntime({
      store: new FileRunStore({ directory: fixture.directory }),
    });

    const recovery = runtime2.recoverRun('repair-run');
    const repaired = runtime2.store.readCheckpoint('repair-run');

    expect(recovery.state).toBe('final_content_approved');
    expect(repaired.state).toBe('final_content_approved');
    expect(repaired.action).toBe('step-started');
  });

  test('human approvals remain idempotent across restarts', () => {
    const fixture = makeStore();
    directories.push(fixture.directory);

    const runtime1 = new GovernanceRuntime({ store: fixture.store });
    const gate1 = new HumanGateController({ governanceRuntime: runtime1 });

    gate1.recordApproval({
      runId: 'human-persist-run',
      from: 'instructionally_reviewed',
      to: 'final_content_approved',
      reviewerIdentity: 'human-reviewer',
      reviewedAt: '2026-10-05T03:10:00Z',
      approvalEvidence: 'approval-evidence-persist-1',
    });

    const runtime2 = new GovernanceRuntime({
      store: new FileRunStore({ directory: fixture.directory }),
    });
    const gate2 = new HumanGateController({ governanceRuntime: runtime2 });

    gate2.recordApproval({
      runId: 'human-persist-run',
      from: 'instructionally_reviewed',
      to: 'final_content_approved',
      reviewerIdentity: 'human-reviewer',
      reviewedAt: '2026-10-05T03:10:00Z',
      approvalEvidence: 'approval-evidence-persist-1',
    });

    expect(runtime2.getRun('human-persist-run')).toHaveLength(1);
    expect(runtime2.recoverRun('human-persist-run')).toMatchObject({
      state: 'final_content_approved',
      status: 'human-approved',
    });
  });

  test('handoff retries remain idempotent across restarts', () => {
    const fixture = makeStore();
    directories.push(fixture.directory);

    const runtime1 = new GovernanceRuntime({ store: fixture.store });
    runtime1.recordFinish({
      runId: 'handoff-persist-run',
      agentId: 'question-agent',
      capability: 'question-drafting',
      from: 'final_content_approved',
      to: 'item_generated',
      requestId: 'handoff-source-request',
    });

    runtime1.recordHandoff({
      runId: 'handoff-persist-run',
      fromAgentId: 'question-agent',
      toAgentId: 'validation-agent',
      capability: 'deterministic-validation',
      state: 'item_generated',
      handoffId: 'handoff-persist-1',
    });

    const runtime2 = new GovernanceRuntime({
      store: new FileRunStore({ directory: fixture.directory }),
    });

    runtime2.recordHandoff({
      runId: 'handoff-persist-run',
      fromAgentId: 'question-agent',
      toAgentId: 'validation-agent',
      capability: 'deterministic-validation',
      state: 'item_generated',
      handoffId: 'handoff-persist-1',
    });

    const ledger = runtime2.getRun('handoff-persist-run');
    expect(ledger.filter((entry) => entry.action === 'handoff-recorded')).toHaveLength(1);
    expect(runtime2.recoverRun('handoff-persist-run')).toMatchObject({
      state: 'item_generated',
      status: 'awaiting-handoff',
    });
  });
});
