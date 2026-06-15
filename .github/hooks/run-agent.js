#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");

const root = process.cwd();
const purpose = process.argv[2] || "architecture";

const indexPath = path.join(root, ".ai", "index.json");
const reportsDir = path.join(root, "reports");
const ragDir = path.join(root, ".ai", "rag");
const selectorPath = path.join(root, ".github", "ollama", "select-model.mjs");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function getModel(purpose) {
  try {
    return execFileSync("node", [selectorPath, purpose], {
      cwd: root,
      encoding: "utf8"
    }).trim();
  } catch {
    return process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
  }
}

function walkForChunks(value, out = []) {
  if (!value) return out;

  if (Array.isArray(value)) {
    for (const item of value) walkForChunks(item, out);
    return out;
  }

  if (typeof value === "object") {
    const text = value.text || value.content || value.chunk || value.body;
    const file = value.file || value.path || value.source || value.filename || value.id;

    if (typeof text === "string" && text.trim().length > 40) {
      out.push({
        file: String(file || "unknown"),
        text: text.trim()
      });
    }

    for (const key of Object.keys(value)) {
      if (!["text", "content", "chunk", "body"].includes(key)) {
        walkForChunks(value[key], out);
      }
    }
  }

  return out;
}

function relevantChunks(chunks, purpose) {
  const keywords = {
    architecture: ["core", "api", "services", "dashboard", "worker", "diagnosis", "telemetry", "analytics", "checkpoint"],
    code_review: ["core", "api", "services", "dashboard", "scripts", "tests", ".js", ".ts"],
    playwright_debugging: ["playwright", "tests", "student-dashboard", "obd2", "spec.js", "test.js"],
    github_actions: [".github", "workflow", "actions", "ci", "yml", "yaml", "scripts"]
  };

  const keys = keywords[purpose] || keywords.code_review;

  const matched = chunks.filter(c => {
    const hay = `${c.file}\n${c.text}`.toLowerCase();
    return keys.some(k => hay.includes(k.toLowerCase()));
  });

  const selected = [
    ...chunks.filter(c => c.file.startsWith("core\\")).slice(0, 10),
    ...chunks.filter(c => c.file.startsWith("api\\")).slice(0, 10),
    ...chunks.filter(c => c.file.startsWith("dashboard\\")).slice(0, 10),
    ...chunks.filter(c => c.file.startsWith("lib\\")).slice(0, 8),
    ...chunks.filter(c => c.file.startsWith("services\\")).slice(0, 5),
    ...chunks.filter(c => c.file.startsWith("docs\\")).slice(0, 5),
    ...chunks.filter(c => c.file.startsWith("scripts\\")).slice(0, 5)
  ];

  return selected.length ? selected.slice(0, 40) : chunks.slice(0, 40);
}

function buildPrompt(purpose, chunks) {
  const context = chunks.map((c, i) =>
    `### SOURCE ${i + 1}: ${c.file}\n${c.text.slice(0, 2500)}`
  ).join("\n\n---\n\n");

  return `
You are analyzing a real local repository.

STRICT RULES:
- Use ONLY the repository context below.
- Do NOT invent files, folders, workflows, errors, metrics, companies, cloud systems, or line numbers.
- Every finding must cite an actual file path from the context.
- If evidence is missing, say what specific evidence is missing.
- Do not mention Nexus Platform, AWS, Kubernetes, Kafka, or enterprise SaaS unless present in the context.
- Output Markdown only.

Purpose: ${purpose}

Required sections:
1. Executive Summary
2. Concrete Findings
3. Risks
4. Affected Files
5. Recommended Changes
6. Verification Commands

Repository context:
${context}
`;
}

function callOllama(model, prompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ model, prompt, stream: false });

    const req = http.request({
      hostname: "127.0.0.1",
      port: 11434,
      path: "/api/generate",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 600000
    }, res => {
      let data = "";

      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Ollama HTTP ${res.statusCode}: ${data}`));
          }

          const parsed = JSON.parse(data);
          resolve(parsed.response || "");
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Ollama request timed out"));
    });

    req.write(payload);
    req.end();
  });
}

function diagnosticReport(purpose, chunks, reason) {
  const files = [...new Set(chunks.map(c => c.file))].slice(0, 80);

  return `# ${purpose} Report

## Executive Summary
A full model-generated report was not produced.

Reason: ${reason}

## Evidence Files Found
${files.map(f => `- \`${f}\``).join("\n")}

## Verification Commands
\`\`\`powershell
node .github\\hooks\\build-embeddings.js
node .github\\hooks\\run-agent.js ${purpose}
Get-Content .ai\\rag\\${purpose}-context.md -First 50
Get-Content reports\\${purpose}.md -First 100
\`\`\`
`;
}

async function main() {
  ensureDir(reportsDir);
  ensureDir(ragDir);

  const outPath = path.join(reportsDir, `${purpose}.md`);

  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(outPath, diagnosticReport(purpose, [], "Missing .ai/index.json. Run build-embeddings first."), "utf8");
    console.log(`Report written: ${outPath}`);
    return;
  }

  const index = readJson(indexPath);
  const allChunks = walkForChunks(index);
  const chunks = relevantChunks(allChunks, purpose);

  const ragPath = path.join(ragDir, `${purpose}-context.md`);

  fs.writeFileSync(
    ragPath,
    chunks.map((c, i) => `# SOURCE ${i + 1}: ${c.file}\n\n${c.text}`).join("\n\n---\n\n"),
    "utf8"
  );

  const model = getModel(purpose);

  console.log(`Purpose: ${purpose}`);
  console.log(`Model: ${model}`);
  console.log(`Loaded chunks: ${chunks.length}`);
  console.log(`RAG context written: ${ragPath}`);

  if (!chunks.length) {
    fs.writeFileSync(outPath, diagnosticReport(purpose, allChunks, "No text chunks found in .ai/index.json."), "utf8");
    console.log(`Report written: ${outPath}`);
    return;
  }

  console.log("Generating grounded report...");

  let report = "";

  try {
    report = (await callOllama(model, buildPrompt(purpose, chunks))).trim();
  } catch (err) {
    report = diagnosticReport(purpose, chunks, `Ollama failed: ${err.message || err}`);
  }

  if (!report || report.length < 100) {
    report = diagnosticReport(purpose, chunks, "Ollama returned empty or too-short response.");
  }

  fs.writeFileSync(outPath, report, "utf8");
  console.log(`Report written: ${outPath}`);
}

main();

