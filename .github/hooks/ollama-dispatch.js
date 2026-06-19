const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const skill = process.argv[2];
const promptFile = process.argv[3];

if (!skill || !promptFile) {
  console.error(
    "Usage: node ollama-dispatch.js <skill> <prompt-file>"
  );
  process.exit(1);
}

const models = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../ollama/models.json"),
    "utf8"
  )
);

const model = models[skill]?.primary;

if (!model) {
  throw new Error(`Unknown skill: ${skill}`);
}

const prompt = fs.readFileSync(promptFile, "utf8");

console.log(`Using model: ${model}`);

execSync(
  `ollama run ${model}`,
  {
    input: prompt,
    stdio: ["pipe", "inherit", "inherit"]
  }
);