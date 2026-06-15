const { execSync } = require("child_process");

console.log("Running local pre-commit checks...");

try {
  execSync("npm run lint", { stdio: "inherit" });

  console.log("✓ Lint passed");
} catch (err) {
  console.error("✗ Lint failed");
  process.exit(1);
}