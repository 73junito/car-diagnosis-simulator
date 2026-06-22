const fs = require("fs");

const input = "data/generated/scenario-questions.generated.json";
const output = "supabase/seed/scenario_questions.sql";

const bank = JSON.parse(fs.readFileSync(input, "utf8"));

function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/'/g, "''");
}

const lines = [];

lines.push("-- Generated scenario question seed");
lines.push("delete from scenario_questions;");

for (const [scenarioId, questions] of Object.entries(bank)) {
  for (const q of questions) {
    lines.push(`
insert into scenario_questions
(
  scenario_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  difficulty,
  topic,
  ase_area
)
values
(
  '${esc(scenarioId)}',
  '${esc(q.question_text)}',
  '${esc(q.option_a)}',
  '${esc(q.option_b)}',
  '${esc(q.option_c)}',
  '${esc(q.option_d)}',
  '${esc(q.correct_answer)}',
  '${esc(q.explanation)}',
  '${esc(q.difficulty)}',
  '${esc(q.topic)}',
  '${esc(q.ase_area)}'
);`);
  }
}

fs.writeFileSync(output, lines.join("\n"), "utf8");
console.log(`Wrote ${output}`);
