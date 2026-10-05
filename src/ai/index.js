const AgentProcess = require('./kernel/agent-process');
const SchedulerKernel = require('./kernel/scheduler-kernel');
const RuntimeEventBus = require('./events/runtime-event-bus');
const AgentRegistry = require('./registry/agent-registry');
const AIOrchestrator = require('./runtime/ai-orchestrator');
const GovernanceRuntime = require('./runtime/governance-runtime');
const PolicyEngine = require('./governance/policy-engine');
const WorkflowStateMachine = require('./governance/workflow-state-machine');
const AgentGovernanceCatalog = require('./governance/agent-governance-catalog');
const RunLedger = require('./governance/run-ledger');
const DiagnosticContracts = require('./diagnostics/contracts');
const ToolGateway = require('./diagnostics/tool-gateway');
const VehicleIdentityResolver = require('./diagnostics/vehicle-identity-resolver');
const { evaluateEvidenceGate } = require('./diagnostics/evidence-gate');
const { evaluateDiagnosticDecision } = require('./diagnostics/diagnostic-engine');
const { buildModelContext } = require('./diagnostics/model-context');
const { getResponsePolicy } = require('./diagnostics/mode-policy');
const Provenance = require('./diagnostics/provenance');
const CircuitToolAdapter = require('./diagnostics/circuit-tool-adapter');

module.exports = {
  AgentProcess,
  SchedulerKernel,
  RuntimeEventBus,
  AgentRegistry,
  AIOrchestrator,
  GovernanceRuntime,
  PolicyEngine,
  WorkflowStateMachine,
  AgentGovernanceCatalog,
  RunLedger,
  DiagnosticContracts,
  ToolGateway,
  VehicleIdentityResolver,
  evaluateEvidenceGate,
  evaluateDiagnosticDecision,
  buildModelContext,
  getResponsePolicy,
  Provenance,
  CircuitToolAdapter,
};
