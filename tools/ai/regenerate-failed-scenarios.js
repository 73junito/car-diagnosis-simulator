const fs = require("fs");

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_URL = process.env.OLLAMA_GENERATE_URL || `${OLLAMA_HOST}/api/generate`;

const scenarioSpecs = {
  "power-loss": {
    title: "Vehicle struggles to accelerate uphill.",
    topic: "engine power loss under load, fuel delivery, air intake restriction, exhaust restriction, transmission slip, sensor diagnostics",
    ase_area: "A8 Engine Performance"
  },
  "overheating": {
    title: "Engine overheats after 10 minutes of driving.",
    topic: "cooling system diagnostics, thermostat, radiator airflow, coolant flow, water pump, cooling fan operation",
    ase_area: "A7 Heating and Air Conditioning"
  },
  "electrical-load": {
    title: "Headlights are dim and flicker while driving.",
    topic: "automotive charging system load testing, alternator output, voltage drop, ground faults, battery condition",
    ase_area: "A6 Electrical/Electronic Systems"
  },
  "hvac-cooling": {
    title: "Air conditioning not cooling.",
    topic: "automotive A/C performance, refrigerant charge, compressor operation, condenser airflow, blend door operation, pressure testing",
    ase_area: "A7 Heating and Air Conditioning"
  }
};

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("No JSON found");
  return JSON.parse(text.slice(start, end + 1));
}

async function ask(model, prompt) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json",
      options: { temperature: 0, num_predict: 4096 }
    })
  });

  const data = await res.json();
  return parseJson(data.response || "");
}

function promptFor(id, spec) {
  return `
Return only valid JSON.

You are an ASE Master Automotive Technician and automotive instructor.

Generate exactly 8 multiple-choice diagnostic questions for this AUTOMOTIVE scenario.

scenario_id: ${id}
Scenario: ${spec.title}
Topic: ${spec.topic}
ASE area: ${spec.ase_area}

Rules:
- Automotive diagnostics only.
- No homes, buildings, computers, laptops, Wi-Fi, office equipment, household appliances, or utility power.
- Use technician-style diagnostic wording.
- Include likely test results, symptoms, scan tool observations, pressure/voltage readings, or inspection findings.
- One correct answer only.
- Plausible distractors.
- Return only JSON.

Required JSON shape:
{
  "scenario_id": "${id}",
  "questions": [
    {
      "question_text": "",
      "option_a": "",
      "option_b": "",
      "option_c": "",
      "option_d": "",
      "correct_answer": "A",
      "explanation": "",
      "difficulty": "intermediate",
      "topic": "${spec.topic}",
      "ase_area": "${spec.ase_area}"
    }
  ]
}
`;
}

(async () => {
  fs.mkdirSync("data/generated/replacements", { recursive: true });

  for (const [id, spec] of Object.entries(scenarioSpecs)) {
    console.log(`Generating replacement for ${id}...`);
    const json = await ask("qwen2.5:7b", promptFor(id, spec));

    if (!Array.isArray(json.questions) || json.questions.length !== 8) {
      throw new Error(`${id} did not return exactly 8 questions`);
    }

    fs.writeFileSync(
      `data/generated/replacements/${id}.replacement.json`,
      JSON.stringify(json, null, 2)
    );
  }

  console.log("Done.");
})();

