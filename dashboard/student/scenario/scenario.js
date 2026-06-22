(function(){
  async function loadScenarioQuestions(scenarioId) {
    try {
      if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        const url =
          `${window.SUPABASE_URL}/rest/v1/scenario_questions` +
          `?scenario_id=eq.${encodeURIComponent(scenarioId)}` +
          `&select=question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,topic,ase_area` +
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
                <article>
                  <h3>Question ${i + 1}</h3>
                  <p>${escapeHtml(q.question_text)}</p>
                  <label class="question-option">A. ${escapeHtml(q.option_a)}</label>
                  <label class="question-option">B. ${escapeHtml(q.option_b)}</label>
                  <label class="question-option">C. ${escapeHtml(q.option_c)}</label>
                  <label class="question-option">D. ${escapeHtml(q.option_d)}</label>
                  <p><strong>Topic:</strong> ${escapeHtml(q.topic)}</p>
                </article>
              `).join("")
            : `<p>No structured questions added yet for this scenario.</p>`
        }
      </section>
    `;
  }

  renderScenarioPage();
})();
