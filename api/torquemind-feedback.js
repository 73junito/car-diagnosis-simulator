const OLLAMA_URL = process.env.TORQUEMIND_AI_URL || 'http://127.0.0.1:11434/api/generate';

module.exports = async (req, res) => {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    scenario,
    question,
    studentAnswer,
    correctAnswer,
    topic,
    delivery_mode,
    ai_assistance_allowed,
    attempt_id
  } = req.body;

  // CRITICAL GUARDRAIL: Assessment mode must ALWAYS reject tutor requests
  // Note: This endpoint is LEGACY FALLBACK ONLY and should not be used for graded assessments.
  // The proper grading flow uses /api/scenario-submissions/grade which enforces attempt ownership
  // and derives assessment mode from the database, not client declarations.
  if (delivery_mode === 'independent_non_proctored_assessment' || ai_assistance_allowed === false) {
    return res.status(403).json({
      error: "AI assistance is not available during official assessment",
      code: "assessment_mode_tutor_disabled",
      advisory: "Use POST /api/scenario-submissions/grade for official assessment grading"
    });
  }

  // SECURITY: Never accept client-supplied correctAnswer
  // The correctAnswer field is present only for signature compatibility with legacy training.
  // Server-side grading is the single source of truth for answer validation.
  if (!studentAnswer || !question) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const prompt = `
You are TorqueMind.

Return ONLY valid JSON.

{
  "reasonIncorrect":"",
  "reasonCorrect":"",
  "aseConcept":"",
  "nextStep":""
}

Scenario:
${scenario}

Question:
${question}

Student Answer:
${studentAnswer}

Correct Answer:
${correctAnswer}

Topic:
${topic}
`;

  try {

    const ollama = await fetch(OLLAMA_URL,{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model: process.env.TORQUEMIND_AI_MODEL || 'gpt-oss:20b',
        stream:false,
        prompt,
        options:{
          temperature:0.2,
          num_predict:500
        }
      })
    });

    const data = await ollama.json();

    res.status(200).send(JSON.parse(data.response));

  } catch(err){

    console.error(err);

    res.status(500).json({
      error:err.message
    });

  }

};
