const fs = require("fs");
const path = require("path");

const dir = "data/generated/replacements";
const output = "supabase/seed/replacement_scenarios.sql";

function esc(v) {
  return String(v ?? "").replace(/'/g, "''");
}

const files = fs.readdirSync(dir).filter(f => f.endsWith(".replacement.json"));
const lines = [];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const scenario = data.scenario_id;

  lines.push(`delete from scenario_questions where scenario_id = '${esc(scenario)}';`);

  for (const q of data.questions) {
    const row = {
      scenario_id: scenario,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      topic: q.topic,
      ase_area: q.ase_area
    };

    if (!row.question_text || !row.option_a || !row.option_b || !row.option_c || !row.option_d) {
      throw new Error(`Incomplete row in ${file}: ${JSON.stringify(row)}`);
    }

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
  '${esc(row.scenario_id)}',
  '${esc(row.question_text)}',
  '${esc(row.option_a)}',
  '${esc(row.option_b)}',
  '${esc(row.option_c)}',
  '${esc(row.option_d)}',
  '${esc(row.correct_answer)}',
  '${esc(row.explanation)}',
  '${esc(row.difficulty)}',
  '${esc(row.topic)}',
  '${esc(row.ase_area)}'
);`);
  }
}

fs.writeFileSync(output, lines.join("\n"), "utf8");
console.log(`Wrote ${output}`);
