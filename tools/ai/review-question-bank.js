const fs = require("fs");

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_URL = process.env.OLLAMA_GENERATE_URL || `${OLLAMA_HOST}/api/generate`;

const badTerms = [
  "home",
  "house",
  "office",
  "building",
  "wifi",
  "wi-fi",
  "appliance",
  "circuit breaker",
  "utility power",
  "power outage",
  "computer",
  "laptop",
  "gaming laptop"
];

async function askOllama(prompt) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen2.5:7b",
      prompt,
      stream: false,
      format: "json",
      options: { temperature: 0, num_predict: 2048 }
    })
  });

  const data = await res.json();
  return JSON.parse(data.response);
}

function scoreQuestion(q) {
  const text = `${q.question_text || ""} ${q.option_a || ""} ${q.option_b || ""} ${q.option_c || ""} ${q.option_d || ""} ${q.topic || ""}`.toLowerCase();

  const hits = badTerms.filter(t => text.includes(t));

  if (hits.length) {
    return {
      score: 10,
      issue_type: "non_automotive_content",
      notes: `Contains non-automotive terms: ${hits.join(", ")}`
    };
  }

  if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_answer) {
    return {
      score: 20,
      issue_type: "incomplete_question",
      notes: "Missing question text, answer option, or correct answer."
    };
  }

  if (!["A", "B", "C", "D"].includes(String(q.correct_answer).trim())) {
    return {
      score: 30,
      issue_type: "invalid_correct_answer",
      notes: "Correct answer must be A, B, C, or D."
    };
  }

  return {
    score: 85,
    issue_type: "passed_basic_review",
    notes: "Passed basic automotive keyword and structure checks."
  };
}

(async () => {
  const input = "data/generated/scenario-questions.generated.json";
  const output = "data/generated/question-quality-review.json";

  const bank = JSON.parse(fs.readFileSync(input, "utf8"));

  const reviews = [];

  for (const [scenario_id, questions] of Object.entries(bank)) {
    for (const q of questions) {
      const review = scoreQuestion(q);
      reviews.push({
        scenario_id,
        question_text: q.question_text,
        ...review
      });
    }
  }

  fs.writeFileSync(output, JSON.stringify(reviews, null, 2));
  console.log(`Wrote ${output}`);

  const failures = reviews.filter(r => r.score < 60);
  console.log(`Reviewed: ${reviews.length}`);
  console.log(`Failures: ${failures.length}`);
  console.table(failures.slice(0, 20));
})();
