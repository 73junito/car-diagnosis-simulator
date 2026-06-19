const path = process.argv[2] || "";

if (
  path.includes("playwright")
) {
  console.log(
    "playwright_debugging"
  );
  process.exit(0);
}

if (
  path.includes(".github/workflows")
) {
  console.log(
    "github_actions"
  );
  process.exit(0);
}

if (
  path.includes("security")
) {
  console.log(
    "security_review"
  );
  process.exit(0);
}

if (
  path.includes("docs")
) {
  console.log(
    "documentation"
  );
  process.exit(0);
}

console.log("code_review");