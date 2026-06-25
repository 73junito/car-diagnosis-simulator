const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";

module.exports = async (req, res) => {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    scenario,
    question,
    studentAnswer,
    correctAnswer,
    topic
  } = req.body;

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
        model:"qwen3.5:latest",
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
