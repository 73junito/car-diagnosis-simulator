const fs = require("fs");

const reviewPath = "data/generated/question-quality-review.json";
const outputPath = "supabase/seed/question_quality_review.sql";

const reviews = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
const failures = reviews.filter(r => r.score < 60);

function esc(v) {
  return String(v ?? "").replace(/'/g, "''");
}

const lines = [];

for (const r of failures) {
  lines.push(`
insert into question_quality_scores
(
  scenario_id,
  score,
  issue_type,
  notes,
  reviewed_by
)
values
(
  '${esc(r.scenario_id)}',
  ${Number(r.score) || 0},
  '${esc(r.issue_type)}',
  '${esc(r.notes)}',
  'local-ai-quality-gate'
);
`);
}

fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
console.log(`Wrote ${outputPath}`);
console.log(`Failures inserted: ${failures.length}`);
