const fs = require("fs");
const path = require("path");

const files = fs.readdirSync("data/generated/replacements")
  .filter(f => f.endsWith(".replacement.json"));

const badTerms = [
  "home", "house", "office", "building", "wifi", "wi-fi",
  "appliance", "circuit breaker", "utility power", "power outage",
  "computer", "laptop", "gaming laptop"
];

const report = [];

for (const file of files) {
  const full = path.join("data/generated/replacements", file);
  const data = JSON.parse(fs.readFileSync(full, "utf8"));
  const seen = new Map();

  for (const q of data.questions || []) {
    const text = `${q.question_text || ""} ${q.option_a || ""} ${q.option_b || ""} ${q.option_c || ""} ${q.option_d || ""} ${q.topic || ""}`.toLowerCase();
    const hits = badTerms.filter(t => text.includes(t));
    const normalized = String(q.question_text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    let score = 85;
    let issue_type = "passed_basic_review";
    let notes = "Passed basic review.";

    if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_answer) {
      score = 20;
      issue_type = "incomplete_question";
      notes = "Missing question, option, or correct answer.";
    } else if (hits.length) {
      score = 10;
      issue_type = "non_automotive_content";
      notes = `Contains non-automotive terms: ${hits.join(", ")}`;
    } else if (seen.has(normalized)) {
      score = 25;
      issue_type = "duplicate_question";
      notes = `Duplicate or near-duplicate of question ${seen.get(normalized)}.`;
    } else if (!["A", "B", "C", "D"].includes(String(q.correct_answer).trim())) {
      score = 30;
      issue_type = "invalid_correct_answer";
      notes = "Correct answer must be A, B, C, or D.";
    }

    seen.set(normalized, (seen.size + 1));

    report.push({
      scenario_id: data.scenario_id,
      question_text: q.question_text,
      score,
      issue_type,
      notes
    });
  }
}

fs.writeFileSync(
  "data/generated/replacements/replacement-quality-review.json",
  JSON.stringify(report, null, 2)
);

const failures = report.filter(r => r.score < 60);
console.log(`Reviewed: ${report.length}`);
console.log(`Failures: ${failures.length}`);
console.table(failures);
