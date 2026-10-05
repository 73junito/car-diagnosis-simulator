const path = require('path');
const { loadDefinition, validate } = require('../scripts/verify-agent-orchestration-foundation');
const WorkflowStateMachine = require('../src/ai/governance/workflow-state-machine');
const AgentGovernanceCatalog = require('../src/ai/governance/agent-governance-catalog');
const RunLedger = require('../src/ai/governance/run-ledger');

describe('agent orchestration foundation', () => {
  const definition = loadDefinition(path.resolve(__dirname, '..'));

  test('foundation contract validates', () => {
    expect(validate().errors).toEqual([]);
  });

  test('agent catalog fails closed for unknown permissions and never grants human approval', () => {
    const catalog = new AgentGovernanceCatalog(definition);
    expect(catalog.list()).toHaveLength(10);
    expect(catalog.can('question-agent', 'prepare')).toBe(true);
    expect(catalog.can('question-agent', 'humanApprove')).toBe(false);
    expect(catalog.can('release-agent', 'release')).toBe(false);
    expect(catalog.can('missing-agent', 'prepare')).toBe(false);
    expect(catalog.can('question-agent', 'unknown-permission')).toBe(false);
  });

  test('state machine blocks skipped and unauthorized transitions', () => {
    const machine = new WorkflowStateMachine(definition);

    expect(
      machine.canTransition({
        from: 'drafted',
        to: 'evidence_mapped',
        actor: 'evidence-agent',
      }).allowed
    ).toBe(true);

    expect(
      machine.canTransition({
        from: 'drafted',
        to: 'scored_delivery_enabled',
        actor: 'assessment-governance-agent',
      }).allowed
    ).toBe(false);

    expect(
      machine.canTransition({
        from: 'instructionally_reviewed',
        to: 'final_content_approved',
        actor: 'instructional-review-agent',
      }).allowed
    ).toBe(false);
  });

  test('human gates require explicit approval', () => {
    const machine = new WorkflowStateMachine(definition);

    expect(
      machine.canTransition({
        from: 'scored_delivery_prepared',
        to: 'scored_delivery_enabled',
        actor: 'human',
      })
    ).toEqual({
      allowed: false,
      reason: 'Explicit human approval is required',
    });

    expect(
      machine.canTransition({
        from: 'scored_delivery_prepared',
        to: 'scored_delivery_enabled',
        actor: 'human',
        explicitHumanApproval: true,
      }).allowed
    ).toBe(true);
  });

  test('positive production API eligibility also requires runtime verification', () => {
    const machine = new WorkflowStateMachine(definition);

    expect(
      machine.canTransition({
        from: 'production_api_review_prepared',
        to: 'production_api_eligible',
        actor: 'human',
        explicitHumanApproval: true,
      }).allowed
    ).toBe(false);

    expect(
      machine.canTransition({
        from: 'production_api_review_prepared',
        to: 'production_api_eligible',
        actor: 'human',
        explicitHumanApproval: true,
        runtimeVerified: true,
      }).allowed
    ).toBe(true);
  });

  test('run ledger creates an append-only audit sequence', () => {
    const ledger = new RunLedger();

    const first = ledger.append({
      runId: 'run-1',
      actor: 'question-agent',
      action: 'draft-question',
      state: 'item_generated',
      metadata: { itemId: 'item-1' },
    });

    const second = ledger.append({
      runId: 'run-1',
      actor: 'validation-agent',
      action: 'validate-exact-payload',
      state: 'exact_payload_validated',
    });

    expect(Object.isFrozen(first)).toBe(true);
    expect(ledger.list({ runId: 'run-1' })).toEqual([first, second]);
    expect(ledger.latest('run-1')).toBe(second);
  });
});
