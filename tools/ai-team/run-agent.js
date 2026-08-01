const fs = require("fs");
const path = require("path");

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_URL = process.env.OLLAMA_GENERATE_URL || `${OLLAMA_HOST}/api/generate`;
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

const agents = {
  architect: {
    model: "qwen3:30b",
    role: "System architect for TorqueMind automotive ASE training platform."
  },
  builder: {
    model: "qwen3.5:latest",
    role: "Full-stack developer. Generate practical SQL, JS, HTML, CSS, and tests."
  },
  reviewer: {
    model: "qwen3.5:0.8b",
    role: "Code reviewer. Find bugs, security issues, missing tests, and bad architecture."
  },
  debugger: {
    model: "deepseek-coder:6.7b-instruct",
    role: "Debugging specialist for JavaScript, Supabase, Vercel, and Playwright."
  },
  tutor: {
    model: "qwen3:30b",
    role: "ASE Master Technician and automotive diagnostic instructor."
  }
};

function usage() {
  console.log(`
Usage:
  node tools/ai-team/run-agent.js <agent> <prompt-file> [output-file]

Agents:
  ${Object.keys(agents).join(", ")}

Example:
  node tools/ai-team/run-agent.js architect prompts/ai-team/adaptive-learning.md data/ai-team/architect-report.md
`);
}

async function ask(model, prompt) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          keep_alive: "10m",
          options: {
            temperature: 0.2,
            num_predict: 2048
          }
        })
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Ollama request failed: HTTP ${res.status}`);
      }

      const data = await res.json();
      return data.response || "";
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      console.warn(`Attempt ${attempt} failed for ${model}: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw lastError;
}

(async () => {
  const [, , agentName, promptFile, outputFile] = process.argv;

  if (!agentName || !promptFile || !agents[agentName]) {
    usage();
    process.exit(1);
  }

  const agent = agents[agentName];

  if (!fs.existsSync(promptFile)) {
    throw new Error(`Prompt file not found: ${promptFile}`);
  }

  const userPrompt = fs.readFileSync(promptFile, "utf8");

  const finalPrompt = `
You are the ${agentName} agent.

Role:
${agent.role}

Project:
TorqueMind / Car Diagnosis Simulator

Important current platform features:
- Scenario engine
- Supabase question bank
- question_attempts
- student_transcript_summary
- ase_domains
- scenario_ase_map
- ase_readiness_summary
- instructor analytics dashboard
- student dashboard
- Vercel deployment
- Supabase migrations

Task:
${userPrompt}
`;

  console.log(`Running ${agentName} using ${agent.model}...`);

  const response = await ask(agent.model, finalPrompt);

  if (outputFile) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, response, "utf8");
    console.log(`Wrote ${outputFile}`);
  } else {
    console.log(response);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});


