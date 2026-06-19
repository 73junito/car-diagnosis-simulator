const fs = require("fs");
const { execSync } = require("child_process");

const file = process.argv[2];

if (!file) {
  console.error("Missing CI log");
  process.exit(1);
}

const log = fs.readFileSync(
  file,
  "utf8"
);

fs.writeFileSync(
  ".github/hooks/ci-log.txt",
  log
);

execSync(
  "node .github/hooks/ollama-dispatch.js ci_debugging .github/hooks/ci-log.txt",
  { stdio: "inherit" }
);