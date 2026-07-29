const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");

const excluded = new Set([
  ".git",
  ".github",
  ".husky",
  ".vercel",
  "api",
  "coverage",
  "dist",
  "node_modules",
  "scripts",
  "test-results",
  "tests"
]);

fs.rmSync(output, {
  recursive: true,
  force: true
});

fs.mkdirSync(output, {
  recursive: true
});

for (const entry of fs.readdirSync(root, {
  withFileTypes: true
})) {
  if (excluded.has(entry.name)) {
    continue;
  }

  if (
    entry.name === "package.json" ||
    entry.name === "package-lock.json" ||
    entry.name === "vercel.json" ||
    entry.name.startsWith(".")
  ) {
    continue;
  }

  const source = path.join(root, entry.name);
  const destination = path.join(output, entry.name);

  if (entry.isDirectory()) {
    fs.cpSync(source, destination, {
      recursive: true,
      force: true
    });
  } else {
    fs.copyFileSync(source, destination);
  }
}

const publicDirectory = path.join(root, "public");

if (fs.existsSync(publicDirectory)) {
  fs.cpSync(publicDirectory, output, {
    recursive: true,
    force: true
  });
}

console.log(`Static deployment assembled in ${output}`);
