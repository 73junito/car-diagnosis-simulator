class WorkflowTracker {
  constructor() { this.steps = []; }
  add(step) { this.steps.push({ ...step, at: new Date().toISOString() }); }
  all() { return this.steps.slice(); }
  reset() { this.steps = []; }
}
module.exports = { WorkflowTracker };
