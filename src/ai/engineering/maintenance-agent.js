"use strict";

const ALLOWED_SCOPES = Object.freeze([
  "tests",
  "documentation",
  "dependency-review",
  "ci",
  "application-code"
]);

function prepareMaintenancePlan({
  scope,
  objective,
  files = [],
  checks = []
} = {}) {
  if (!ALLOWED_SCOPES.includes(scope)) {
    throw new Error("Unsupported maintenance scope");
  }
  if (!objective || typeof objective !== "string") {
    throw new Error("Maintenance objective is required");
  }

  return {
    scope,
    objective: objective.trim().slice(0, 1000),
    files: Array.isArray(files) ? files.slice(0, 50).map(String) : [],
    checks: Array.isArray(checks) ? checks.slice(0, 50).map(String) : [],
    boundary: {
      preparationOnly: true,
      mayCommit: false,
      mayMerge: false,
      mayDeploy: false,
      mayRelease: false,
      requiresHumanExecutionApproval: true
    }
  };
}

function createEngineeringMaintenanceAgent() {
  return {
    id: "engineering-maintenance-agent",
    name: "Engineering Maintenance Agent",
    capabilities: ["engineering-maintenance-plan-preparation"],
    defaultPriority: 1,
    mayPrepare: true,
    mayHumanApprove: false,
    mayRelease: false,
    async execute({ input = {}, process } = {}) {
      if (process?.capability !== "engineering-maintenance-plan-preparation") {
        throw new Error("Unsupported engineering maintenance capability");
      }
      return prepareMaintenancePlan(input);
    }
  };
}

module.exports = {
  ALLOWED_SCOPES,
  prepareMaintenancePlan,
  createEngineeringMaintenanceAgent
};
