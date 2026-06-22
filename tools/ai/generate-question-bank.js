const fs = require("fs");

const OLLAMA_URL = "http://localhost:11434/api/generate";

const generatorModels = ["qwen2.5:7b", "llama3.1:8b"];
const verifierModel = "qwen3:30b";

const scenarios = [
  "no-crank",
  "no-start",
  "overheating",
  "electrical-load",
  "misfire",
  "steering-alignment",
  "hvac-cooling",
  "stalling",
  "misfire-9",
  "power-loss",
  "no-crank-11",
  "intermittent-starting",
  "charging-system",
  "can-bus-network",
  "hybrid-ev",
  "diesel-aftertreatment",
  "hybrid-ev-17"
];

function parseJson(text) {
  if (!text || !text.trim()) throw new Error("Empty model response");
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found");
  return JSON.parse(text.slice(start, end + 1));
}

async function ask(model, prompt, outName) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0,
        num_predict: 4096
      }
    })
  });

  const data = await res.json();
  const text = data.response || "";
  fs.writeFileSync(`data/generated/${outName}.raw.txt`, text);
  return parseJson(text);
}

function generatorPrompt(scenario) {
  return `Return only valid JSON. Generate 8 ASE-style diagnostic questions for ${scenario}.
Schema:
{"scenario_id":"${scenario}","questions":[{"question_text":"string","option_a":"string","option_b":"string","option_c":"string","option_d":"string","correct_answer":"A","explanation":"string","difficulty":"beginner","topic":"string","ase_area":"string"}]}`;
}

function verifierPrompt(scenario, drafts) {
  return `Return only valid JSON. Merge, correct, and deduplicate these questions for ${scenario}. Return exactly this shape:
{"scenario_id":"${scenario}","questions":[{"question_text":"string","option_a":"string","option_b":"string","option_c":"string","option_d":"string","correct_answer":"A","explanation":"string","difficulty":"beginner","topic":"string","ase_area":"string"}]}
Drafts:
${JSON.stringify(drafts).slice(0, 12000)}`;
}

(async () => {
  fs.mkdirSync("data/generated", { recursive: true });

  const finalBank = {};

  for (const scenario of scenarios) {
    console.log(`\n=== ${scenario} ===`);

    const drafts = [];

    for (const model of generatorModels) {
      console.log(`Generating with ${model}...`);
      const draft = await ask(
        model,
        generatorPrompt(scenario),
        `${scenario}.${model.replace(/[:.]/g, "-")}`
      );
      drafts.push({ model, draft });
      fs.writeFileSync(
        `data/generated/${scenario}.${model.replace(/[:.]/g, "-")}.json`,
        JSON.stringify(draft, null, 2)
      );
    }

    console.log(`Verifying with ${verifierModel}...`);

    let verified;
    try {
      verified = await ask(verifierModel, verifierPrompt(scenario, drafts), `${scenario}.qwen3-30b`);
    } catch (err) {
      console.warn(`Verifier failed for ${scenario}: ${err.message}`);
      console.warn("Using qwen2.5 draft as fallback for this scenario.");
      verified = drafts[0].draft;
    }

    finalBank[scenario] = verified.questions || [];

    fs.writeFileSync(
      `data/generated/${scenario}.verified.json`,
      JSON.stringify({ scenario_id: scenario, questions: finalBank[scenario] }, null, 2)
    );
  }

  fs.writeFileSync(
    "data/generated/scenario-questions.generated.json",
    JSON.stringify(finalBank, null, 2)
  );

  console.log("\nDONE: data/generated/scenario-questions.generated.json");
})();
