// Agent Runner - runs the agent control loop
export async function runAgent(goal: string) {
  const plan = await planner(goal);
  let state = { goal, plan, steps: [] };
  for (const step of plan.steps) {
    const result = await executor(step);
    state.steps.push({ step, result });
    const ok = await verifier(step, result);
    if (!ok) break;
  }
  return state;
}

function planner(goal: string) {
  throw new Error("Function not implemented.");
}


function executor(step: any) {
  throw new Error("Function not implemented.");
}


function verifier(step: any, result: any) {
  throw new Error("Function not implemented.");
}
