const { execSync } = require("child_process");

console.log("Running pre-push validation...");

try {
  execSync("npm test", {
    stdio: "inherit"
  });

  console.log("✓ Tests passed");
}
catch (err) {
  console.error("✗ Tests failed");
  process.exit(1);
}