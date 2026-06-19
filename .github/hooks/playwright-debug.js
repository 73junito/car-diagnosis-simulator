const fs = require("fs");
const { execSync } = require("child_process");

const logFile = process.argv[2];

if (!logFile) {
  console.error("Provide Playwright log");
  process.exit(1);
}

const content = fs.readFileSync(
  logFile,
  "utf8"
);

const prompt = `
Analyze this Playwright failure.

${content}

Find:

1. Root cause
2. Exact fix
3. Updated code
`;

fs.writeFileSync(
  ".github/hooks/playwright-debug.txt",
  prompt
);

execSync(
  "node .github/hooks/ollama-dispatch.js playwright_debugging .github/hooks/playwright-debug.txt",
  { stdio: "inherit" }
);