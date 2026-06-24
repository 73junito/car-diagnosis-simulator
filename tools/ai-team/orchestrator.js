const fs = require("fs");
const { spawnSync } = require("child_process");

const workflowPath = process.argv[2] || "tools/ai-team/workflow.json";
const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));

let combined = fs.readFileSync(workflow.input, "utf8");
const outputs = [];

for (const step of workflow.steps) {
  const tempPrompt = `data/ai-team/orchestrator/tmp-${step.agent}.md`;
  fs.mkdirSync("data/ai-team/orchestrator", { recursive: true });

  fs.writeFileSync(
    tempPrompt,
    `${combined}\n\nPrevious agent outputs:\n${outputs.join("\n\n---\n\n")}`,
    "utf8"
  );

  console.log(`Running ${step.agent}...`);

  const result = spawnSync(
    "node",
    ["tools/ai-team/run-agent.js", step.agent, tempPrompt, step.output],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    process.exit(result.status);
  }

  outputs.push(fs.readFileSync(step.output, "utf8"));
}

fs.writeFileSync(
  workflow.finalReport,
  `# AI Team Final Report: ${workflow.name}\n\n${outputs.join("\n\n---\n\n")}`,
  "utf8"
);

console.log(`Wrote ${workflow.finalReport}`);

