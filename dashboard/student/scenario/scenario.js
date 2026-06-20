(function(){
  const params = new URLSearchParams(location.search);
  const id = params.get("id") || params.get("scenario");

  const registry = window.SCENARIO_REGISTRY || [];
  const item = registry.find(r =>
    r.id === id ||
    String(r.numericId) === String(id)
  );

  const scenario = item ? (item.raw || item) : null;
  const key = item ? item.id : id;
  const questions = (window.SCENARIO_QUESTIONS || {})[key] || [];

  const root = document.getElementById("scenarioPage");

  if (!root || !scenario) {
    root.innerHTML = `<div class="scenario-card"><h1>Scenario not found</h1></div>`;
    return;
  }

  const title = item.title || scenario.title || scenario.trainingFocus || scenario.symptoms || key;

  root.innerHTML = `
    <section class="scenario-hero">
      <div class="scenario-label">Scenario ${scenario.id || item.numericId || ""}</div>
      <h1>${title}</h1>
      <p>${scenario.symptoms || item.shortSymptom || ""}</p>
      <p class="note"><strong>Topic:</strong> ${scenario.trainingFocus || item.category || "Diagnostic training"}</p>
    </section>

    <section class="scenario-card">
      <h2>Systems Involved</h2>
      <ul>
        <li>${scenario.primarySystem || item.category || "General"}</li>
        ${(scenario.secondarySystems || []).map(s => `<li>${s}</li>`).join("")}
      </ul>
    </section>

    <section class="scenario-card">
      <h2>Recommended Tools</h2>
      <ul>
        ${(scenario.requiredTools || ["Scan Tool", "Visual Inspection"]).map(t => `<li>${t}</li>`).join("")}
      </ul>
    </section>

    <section class="scenario-card">
      <h2>Questions</h2>
      ${
        questions.length
          ? questions.map((q, i) => `
              <article>
                <h3>Question ${i + 1}</h3>
                <p>${q.question_text}</p>
                <label class="question-option">A. ${q.option_a}</label>
                <label class="question-option">B. ${q.option_b}</label>
                <label class="question-option">C. ${q.option_c}</label>
                <label class="question-option">D. ${q.option_d}</label>
                <p><strong>Topic:</strong> ${q.topic}</p>
              </article>
            `).join("")
          : `<p>No structured questions added yet for this scenario.</p>`
      }
    </section>
  `;
})();
