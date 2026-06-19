const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const diff = execSync("git diff HEAD~1")
  .toString();

const prompt = `
Review this code diff.

${diff}
`;

fs.writeFileSync(
  path.join(__dirname, "temp-review.txt"),
  prompt
);

execSync(
  "node .github/hooks/ollama-dispatch.js code_review .github/hooks/temp-review.txt",
  { stdio: "inherit" }
);