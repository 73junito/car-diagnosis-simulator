const fs = require("fs");

async function askQwen3(prompt) {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen3:30b",
      prompt,
      stream: false,
      options: {
        temperature: 0,
        num_predict: 2048
      }
    })
  });

  const data = await res.json();
  return data.response || "";
}

(async () => {
  const bank = JSON.parse(
    fs.readFileSync("data/generated/scenario-questions.generated.json", "utf8")
  );

  const prompt = `
You are an ASE Master Automotive Technician.

Review this generated automotive question bank.
Do not rewrite the full JSON.
Return a plain-text quality report only.

Check:
- wrong answers
- duplicate questions
- weak explanations
- missing ASE area
- non-automotive wording
- safety issues
- scenarios with fewer than 5 questions

Question bank:
${JSON.stringify(bank).slice(0, 18000)}
`;

  const report = await askQwen3(prompt);
  fs.writeFileSync("data/generated/qwen3-verification-report.txt", report);
  console.log(report);
})();
