"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("@playwright/test");

const root = path.resolve(__dirname, "..", "exam-site");
const port = 3011;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mime(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function resolveRequest(urlPath) {
  let clean = decodeURIComponent((urlPath || "/").split("?")[0]);
  if (clean.endsWith("/")) clean += "index.html";
  const file = path.resolve(root, "." + clean);
  if (!file.startsWith(root)) return null;
  return file;
}
const server = http.createServer((req, res) => {
  const file = resolveRequest(req.url);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": mime(file),
    "Cache-Control": "no-store"
  });
  fs.createReadStream(file).pipe(res);
});

async function verify() {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/learning-path/`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForSelector("#undergraduate-content .course-grid article");
  await page.waitForSelector("#graduate-content .graduate-grid article");

  const undergradCount = await page.locator("#undergraduate-content .course-grid article").count();
  const graduateCount = await page.locator("#graduate-content .graduate-grid article").count();

  assert(undergradCount === 4, `Expected 4 undergraduate courses, found ${undergradCount}`);
  assert(graduateCount === 5, `Expected 5 graduate courses, found ${graduateCount}`);

  const body = await page.locator("body").innerText();
  assert(body.includes("CIP 47.0604"), "Undergraduate CIP missing");
  assert(body.includes("CIP 15.0803"), "Graduate CIP missing");
  assert(body.includes("Vehicle Systems and Testing"), "Graduate course missing");

  const appliedResearch = page.locator("#graduate-content article")
    .filter({ hasText: "Applied Research" });
  await appliedResearch.locator("summary").click();

  const researchText = await appliedResearch.innerText();
  assert(researchText.includes("Search Google Scholar"), "Google Scholar step missing");
  assert(researchText.includes("Resolve canonical DOI or publisher source"), "Canonical citation step missing");

  assert(pageErrors.length === 0, `Page errors: ${pageErrors.join("; ")}`);

  console.log("[PASS] Exam pathway page renders canonical curriculum data");
  console.log(`[PASS] Rendered ${undergradCount} undergraduate and ${graduateCount} graduate courses`);
  await browser.close();
}
try {
  verify()
    .then(() => server.close())
    .catch((error) => {
      console.error(error.stack || error);
      server.close(() => process.exit(1));
    });
} catch (error) {
  console.error(error.stack || error);
  server.close(() => process.exit(1));
}