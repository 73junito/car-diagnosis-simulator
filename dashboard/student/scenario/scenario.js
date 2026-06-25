(function(){
  async function loadScenarioQuestions(scenarioId) {
    try {
      if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        const url =
          `${window.SUPABASE_URL}/rest/v1/scenario_questions` +
          `?scenario_id=eq.${encodeURIComponent(scenarioId)}` +
          `&select=id,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,topic,ase_area` +
          `&order=created_at.asc`;

        const res = await fetch(url, {
          headers: {
            apikey: window.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${window.SUPABASE_ANON_KEY}`
          }
        });

        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length) return rows;
        }
      }
    } catch (e) {
      console.warn("Supabase question load failed; falling back to static questions.", e);
    }

    return (window.SCENARIO_QUESTIONS && window.SCENARIO_QUESTIONS[scenarioId]) || [];
  }

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  async function saveQuestionAttempt(payload) {
    try {
      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return;

      await fetch(`${window.SUPABASE_URL}/rest/v1/question_attempts`, {
        method: "POST",
        headers: {
          apikey: window.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${window.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Question attempt save failed.", e);
    }
  }

  async function renderScenarioPage() {
    const params = new URLSearchParams(location.search);
    const id = params.get("id") || params.get("scenario");

    const registry = window.SCENARIO_REGISTRY || [];
    const item = registry.find(r =>
      r.id === id ||
      String(r.numericId) === String(id)
    );

    const scenario = item ? (item.raw || item) : null;
    const key = item ? item.id : id;
    const root = document.getElementById("scenarioPage");
    const startedAt = Date.now();

    if (!root || !scenario) {
      if (root) root.innerHTML = `<div class="scenario-card"><h1>Scenario not found</h1></div>`;
      return;
    }

    const questions = await loadScenarioQuestions(key);
    const title = item.title || scenario.title || scenario.trainingFocus || scenario.symptoms || key;

    root.innerHTML = `
      <section class="scenario-hero">
        <div class="scenario-label">Scenario ${escapeHtml(scenario.id || item.numericId || "")}</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(scenario.symptoms || item.shortSymptom || "")}</p>
        <p class="note"><strong>Topic:</strong> ${escapeHtml(scenario.trainingFocus || item.category || "Diagnostic training")}</p>
      </section>

      <section class="scenario-card">
        <h2>Systems Involved</h2>
        <ul>
          <li>${escapeHtml(scenario.primarySystem || item.category || "General")}</li>
          ${(scenario.secondarySystems || []).map(s => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
      </section>

      <section class="scenario-card">
        <h2>Recommended Tools</h2>
        <ul>
          ${(scenario.requiredTools || ["Scan Tool", "Visual Inspection"]).map(t => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>
      </section>

      <section class="scenario-card">
        <h2>Questions</h2>
        ${
          questions.length
            ? questions.map((q, i) => `
                <article class="question-card">
                  <h3>Question ${i + 1}</h3>
                  <p>${escapeHtml(q.question_text)}</p>

                  <div
                    class="question-options"
                    data-question-id="${escapeHtml(q.id || "")}"
                    data-correct-answer="${escapeHtml(q.correct_answer || "")}"
                  >
                    <label class="question-option">
                      <input type="radio" name="q${i}" value="A">
                      A. ${escapeHtml(q.option_a)}
                    </label>

                    <label class="question-option">
                      <input type="radio" name="q${i}" value="B">
                      B. ${escapeHtml(q.option_b)}
                    </label>

                    <label class="question-option">
                      <input type="radio" name="q${i}" value="C">
                      C. ${escapeHtml(q.option_c)}
                    </label>

                    <label class="question-option">
                      <input type="radio" name="q${i}" value="D">
                      D. ${escapeHtml(q.option_d)}
                    </label>
                  </div>

                  <button class="submit-answer" type="button">
                    Submit Answer
                  </button>

                  <p class="answer-feedback" aria-live="polite"></p>

<div class="torquemind-feedback" hidden>
  <h4>🧠 TorqueMind AI Tutor</h4>
  <div class="torquemind-body">
    Generating explanation...
  </div>
</div>
                  <p><strong>Topic:</strong> ${escapeHtml(q.topic)}</p>
                </article>
              `).join("")
            : `<p>No structured questions added yet for this scenario.</p>`
        }
      </section>
    `;

    root.querySelectorAll(".submit-answer").forEach((button) => {
      button.addEventListener("click", async () => {
        const article = button.closest("article");
        const options = article.querySelector(".question-options");
        const feedback = article.querySelector(".answer-feedback");
        const selected = article.querySelector("input[type='radio']:checked");

        if (!selected) {
          feedback.textContent = "Select an answer first.";
          return;
        }

        const correct = options.dataset.correctAnswer;
        const isCorrect = selected.value === correct;

        feedback.textContent = isCorrect
          ? "Correct."
          : `Incorrect. Correct answer: ${correct}.`;

        button.disabled = true;

        await saveQuestionAttempt({
          scenario_id: key,
          question_id: options.dataset.questionId || null,
          selected_answer: selected.value,
          correct_answer: correct,
          is_correct: isCorrect,
          time_seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000))
        });
      });
    });
  }

  renderScenarioPage();
})();



