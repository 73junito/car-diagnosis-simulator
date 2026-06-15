const mapping = {
  ".github/workflows": "github_actions",
  "tests/playwright": "playwright_debugging",
  "tests": "ci_debugging",
  "docs": "documentation",
  "security": "security_review",
  "src": "code_review"
};

const file = process.argv[2] || "";

for (const key of Object.keys(mapping)) {
  if (file.includes(key)) {
    console.log(mapping[key]);
    process.exit(0);
  }
}

console.log("code_review");