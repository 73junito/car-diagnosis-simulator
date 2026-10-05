'use strict';

const fs = require('fs');
const path = require('path');
const WorkflowStateMachine = require('../src/ai/governance/workflow-state-machine');
const AgentGovernanceCatalog = require('../src/ai/governance/agent-governance-catalog');

function loadDefinition(root = path.resolve(__dirname, '..')) {
  return JSON.parse(
    fs.readFileSync(
      path.join(root, 'data', 'architecture', 'agent-orchestration-foundation.json'),
      'utf8'
    )
  );
}

function validate() {
  const definition = loadDefinition();
  const errors = [];

  if (definition.artifact_type !== 'agent-orchestration-foundation') {
    errors.push('artifact_type mismatch');
  }
  if (definition.default_policy !== 'deny') {
    errors.push('default policy must be deny');
  }

  const ids = definition.agents.map((agent) => agent.id);
  if (new Set(ids).size !== ids.length) {
    errors.push('agent ids must be unique');
  }

  const catalog = new AgentGovernanceCatalog(definition);
  for (const agent of catalog.list()) {
    if (agent.may_human_approve !== false) {
      errors.push(agent.id + ': agents may not human-approve');
    }
    if (agent.may_release !== false) {
      errors.push(agent.id + ': agents may not release');
    }
  }

  const machine = new WorkflowStateMachine(definition);
  for (const transition of definition.transitions) {
    if (!machine.states.has(transition.from) || !machine.states.has(transition.to)) {
      errors.push('transition references unknown state');
    }
    if (
      transition.requires_explicit_human_approval &&
      JSON.stringify(transition.actors) !== JSON.stringify(['human'])
    ) {
      errors.push(
        transition.from + ' -> ' + transition.to +
        ': human approval transitions must be human-only'
      );
    }
  }

  const release = machine.canTransition({
    from: 'assessment_release_prepared',
    to: 'assessment_released',
    actor: 'release-agent',
    explicitHumanApproval: true,
  });
  if (release.allowed) {
    errors.push('release-agent must not be able to perform final release');
  }

  const apiWithoutRuntime = machine.canTransition({
    from: 'production_api_review_prepared',
    to: 'production_api_eligible',
    actor: 'human',
    explicitHumanApproval: true,
    runtimeVerified: false,
  });
  if (apiWithoutRuntime.allowed) {
    errors.push('production API eligibility must require runtime verification');
  }

  return { definition, errors };
}

if (require.main === module) {
  const result = validate();
  console.log('agents: ' + result.definition.agents.length);
  console.log('states: ' + result.definition.states.length);
  console.log('transitions: ' + result.definition.transitions.length);
  if (result.errors.length) {
    result.errors.forEach((error) => console.error('FAIL: ' + error));
    process.exitCode = 1;
  } else {
    console.log('PASS: orchestration foundation is fail-closed and human approval gates are preserved.');
  }
}

module.exports = { loadDefinition, validate };
