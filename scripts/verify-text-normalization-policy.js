"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const attributes = fs.readFileSync(path.join(root, ".gitattributes"), "utf8");
const editorConfig = fs.readFileSync(path.join(root, ".editorconfig"), "utf8");

const errors = [];

if (!attributes.includes("* text=auto eol=lf")) {
  errors.push(".gitattributes must define LF as the default text EOL");
}
if (!attributes.includes("*.bat text eol=crlf") || !attributes.includes("*.cmd text eol=crlf")) {
  errors.push(".gitattributes must preserve Windows batch/cmd CRLF");
}
if (!/charset\s*=\s*utf-8/i.test(editorConfig)) {
  errors.push(".editorconfig must require UTF-8");
}
if (!/end_of_line\s*=\s*lf/i.test(editorConfig)) {
  errors.push(".editorconfig must require LF by default");
}
if (!/insert_final_newline\s*=\s*true/i.test(editorConfig)) {
  errors.push(".editorconfig must require a final newline");
}

if (errors.length) {
  console.error("[FAIL] Text normalization policy");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}

console.log("[PASS] Text normalization policy");
