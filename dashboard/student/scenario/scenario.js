(function(){
  const QUESTIONS_PER_ATTEMPT = 20;
  const REGENERATE_AFTER_FAILED_ATTEMPTS = 3;
  const PASSING_SCORE_PERCENT = 80;

  function getStudentId() {
    const key = "torquemind.student.id";
    try {
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      // Use secure randomness for student id generation
      const cryptoApi = getCrypto();
      let randPart = null;
      if (typeof cryptoApi.randomUUID === 'function') {
        randPart = cryptoApi.randomUUID();
      } else {
        randPart = secureRandomInt(100000).toString(10);
      }
      const generated = `student-${Date.now()}-${randPart}`;
      localStorage.setItem(key, generated);
      return generated;
    } catch (_) {
      return "student-anon";
    }
  }

  function getCrypto() {
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
      throw new Error('Secure randomness is unavailable');
    }
    return cryptoApi;
  }

  function secureRandomInt(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive safe integer');
    }

    const cryptoApi = getCrypto();
    const maxUint32 = 0x100000000;
    const limit = maxUint32 - (maxUint32 % maxExclusive);
    const values = new Uint32Array(1);

    let value;
    do {
      cryptoApi.getRandomValues(values);
      value = values[0];
    } while (value >= limit);

    return value % maxExclusive;
  }

  function getAttemptStorageKey(moduleId, studentId) {
    return `torquemind.scenario.attempt.${moduleId}.${studentId}`;
  }

  function readAttemptState(moduleId, studentId) {
    const key = getAttemptStorageKey(moduleId, studentId);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return {
          moduleId,
          studentId,
          history: [],
          activeAttempt: null
        };
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") throw new Error("invalid state");
      return {
        moduleId,
        studentId,
        history: Array.isArray(parsed.history) ? parsed.history : [],
        activeAttempt: parsed.activeAttempt && typeof parsed.activeAttempt === "object"
          ? parsed.activeAttempt
          : null
      };
    } catch (_) {
      return {
        moduleId,
        studentId,
        history: [],
        activeAttempt: null
      };
    }
  }

  function writeAttemptState(moduleId, studentId, state) {
    const key = getAttemptStorageKey(moduleId, studentId);
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (_) {
      // Best-effort only.
    }
  }

  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function normalizeQuestionBank(scenarioId, questions) {
    const seen = new Set();
    const out = [];
    (Array.isArray(questions) ? questions : []).forEach((q, i) => {
      const stem = (q && q.question_text ? String(q.question_text) : "").trim();
      const sourceId = q && q.id ? String(q.id) : "";
      const generated = `q-${scenarioId}-${i}-${hashCode(stem).toString(16)}`;
      const id = sourceId || generated;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({ ...q, __qid: id });
    });
    return out;
  }

  function shuffleQuestions(list) {
    // Fisher–Yates shuffle using secure randomness to avoid Math.random()
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function createAttempt({ questionBank, failedAttempts, previousQuestionIds = [], attemptNumber }) {
    const mustUseNewQuestions = failedAttempts >= REGENERATE_AFTER_FAILED_ATTEMPTS;

    let eligibleQuestions = questionBank;

    if (mustUseNewQuestions) {
      const used = new Set(previousQuestionIds);
      eligibleQuestions = questionBank.filter((question) => !used.has(question.__qid));
    }

    if (eligibleQuestions.length < QUESTIONS_PER_ATTEMPT) {
      eligibleQuestions = questionBank;
    }

    const selected = shuffleQuestions(eligibleQuestions)
      .slice(0, QUESTIONS_PER_ATTEMPT);

    return {
      attemptNumber,
      startedAt: new Date().toISOString(),
      questionIds: selected.map((q) => q.__qid),
      answers: {}
    };
  }

  function countCorrectAnswers(answerMap) {
    return Object.values(answerMap || {}).filter((x) => x && x.isCorrect).length;
  }

  function buildAttemptHistoryEntry({ moduleId, studentId, activeAttempt, score, passed }) {
    return {
      moduleId,
      studentId,
      attemptNumber: activeAttempt.attemptNumber,
      questionIds: activeAttempt.questionIds.slice(),
      answers: activeAttempt.answers,
      score,
      passed,
      completedAt: new Date().toISOString()
    };
  }

  async function saveAttemptSummary(entry) {
    try {
      const payload = {
        user_id: entry.studentId,
        scenario: entry.moduleId,
        workflow_type: "scenario",
        payload_json: entry,
        score: entry.score,
        completion_state: entry.passed ? "passed" : "failed"
      };

      await fetch("/api/attempts/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Attempt summary save failed.", e);
    }
  }

  async function loadScenarioQuestions(scenarioId) {
    try {
      // Always use the API endpoint to prevent answer key exposure
      const res = await fetch(
        `/api/scenario-questions-approved?scenarioId=${encodeURIComponent(scenarioId)}`
      );

      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.questions) ? data.questions : [];
      }
    } catch (e) {
      console.warn("API question load failed; falling back to static questions.", e);
    }

    return (window.SCENARIO_QUESTIONS && window.SCENARIO_QUESTIONS[scenarioId]) || [];
  }

  async function loadApprovedRegistry() {
    // Try API first, then local in-repo JSON, then window.APPROVED_SOURCES
    try {
      if (typeof fetch === 'function') {
        try {
          const res = await fetch('/api/approved-sources');
          if (res.ok) {
            const json = await res.json();
            window.APPROVED_SOURCES = json;
            return json;
          }
        } catch (e) {
          // ignore and fallback to static file
        }

        try {
          const res2 = await fetch('/data/approved-sources.json');
          if (res2.ok) {
            const json = await res2.json();
            window.APPROVED_SOURCES = json;
            return json;
          }
        } catch (e) {
          // ignore – we'll fallback to existing `window.APPROVED_SOURCES` if present
        }
      }
    } catch (_) {
      // noop
    }

    return window.APPROVED_SOURCES || {};
  }

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Audit trail is recorded server-side by grading endpoint (in attempt_answers table)
  // Do not insert directly into question_attempts table (will be locked down)

  async function submitAnswerForGrading({
    attemptId,
    questionId,
    scenarioId,
    selectedAnswer,
    isAssessmentMode
  }) {
    try {
      // Security: In assessment mode, require a real server-created attempt
      // Never allow "local-attempt" or empty strings in assessment mode
      if (isAssessmentMode && (!attemptId || attemptId === 'local-attempt')) {
        throw new Error('Assessment mode requires a server-created attempt ID. This attempt may not be properly initialized for assessment.');
      }

      const response = await fetch('/api/scenario-submissions/grade', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attempt_id: attemptId,
          question_id: questionId,
          scenario_id: scenarioId,
          student_answer: selectedAnswer,
          delivery_mode: isAssessmentMode
            ? 'independent_non_proctored_assessment'
            : 'training'
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Server error: ${response.status}`);
      }

      return response.json();
    } catch (err) {
      console.error('Failed to grade answer:', err);
      throw err;
    }
  }

  async function loadTorqueMindExplanation({ article, title, selected, correct, explanation, isAssessmentMode }) {
    if (isAssessmentMode) {
      // Never show explanations during assessment
      return;
    }

    const aiPanel = article.querySelector(".torquemind-feedback");
    const aiBody = article.querySelector(".torquemind-body");

    if (!aiPanel || !aiBody) return;

    aiPanel.hidden = false;
    
    // If server provided an explanation, use it directly
    if (explanation) {
      aiBody.innerHTML = `
        <p><strong>Explanation</strong></p>
        <p>${escapeHtml(explanation)}</p>
      `;
      return;
    }

    // Fallback: Try to get explanation from tutor API (legacy)
    aiBody.textContent = "Generating AI explanation...";

    try {
      const feedbackUrl = window.TorqueMindApi?.resolveApiUrl?.("/api/torquemind-feedback")
        || "/api/torquemind-feedback";
      const response = await fetch(feedbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          scenario: title,
          question: article.dataset.questionText || "",
          studentAnswer: selected.value,
          correctAnswer: correct,
          topic: article.dataset.topic || ""
        })
      });

      const ai = await response.json();

      aiBody.innerHTML = `
        <p><strong>Why your answer was incorrect</strong></p>
        <p>${escapeHtml(ai.reasonIncorrect || "No explanation returned.")}</p>

        <p><strong>Correct reasoning</strong></p>
        <p>${escapeHtml(ai.reasonCorrect || "No reasoning returned.")}</p>

        <p><strong>ASE Concept</strong></p>
        <p>${escapeHtml(ai.aseConcept || "No ASE concept returned.")}</p>

        <p><strong>Next Diagnostic Step</strong></p>
        <p>${escapeHtml(ai.nextStep || "No next step returned.")}</p>
      `;
    } catch (err) {
      console.warn(
      "AI feedback unavailable:",
      err && err.message ? err.message : err
    );
      aiBody.innerHTML = "<p>AI explanation is currently unavailable.</p>";
    }
  }

  function renderAttemptSummary(target, summary) {
    if (!target || !summary) return;
    target.hidden = false;
    target.innerHTML = `
      <p><strong>Attempt ${summary.attemptNumber}</strong> completed.</p>
      <p><strong>Score:</strong> ${summary.score}% (${summary.passed ? "PASS" : "FAIL"})</p>
      <p><strong>Correct:</strong> ${summary.correctCount}/${summary.totalQuestions}</p>
    `;
  }

  function resolveLegacyScenario(registry, legacyId) {
    // Try numeric ID first (safe because IDs are unique)
    const numericMatch = registry.find(
      (item) => String(item.numericId) === String(legacyId)
    );
    if (numericMatch) return numericMatch;

    // For string IDs: check if this is an ambiguous category
    // Count against the COMPLETE scenarios array to detect true ambiguity
    // (not just what's in the deduplicated registry)
    const allScenarios = window.scenarios || [];
    const categoryMatches = allScenarios.filter(
      (item) => String(item.symptomCategory) === String(legacyId)
    );

    // Fail-closed: if category is ambiguous (>1 scenario), reject
    if (categoryMatches.length > 1) return null;

    // If exactly 1 scenario has this category, return it
    if (categoryMatches.length === 1) {
      const match = categoryMatches[0];
      return registry.find(
        (item) => String(item.scenario_key) === String(match.scenario_key) ||
                  String(item.numericId) === String(match.id)
      );
    }

    // Fallback: check if legacyId matches a registry slug (backward compat)
    // This allows ?id=scenario-1 and other slug-based lookups
    const slugMatches = registry.filter(
      (item) => String(item.id) === String(legacyId)
    );
    return slugMatches.length === 1 ? slugMatches[0] : null;
  }

  async function renderScenarioPage() {
    const params = new URLSearchParams(location.search);
    const scenarioKey = params.get("scenario");
    const legacyId = params.get("id");
    const mode = params.get("mode") || "training";
    const attemptId = params.get("attempt_id");
    const isAssessmentMode = mode === "assessment";

    const registry = window.SCENARIO_REGISTRY || [];

    // Strict routing: prefer scenario_key (new unambiguous identifier)
    let item = null;
    if (scenarioKey) {
      item = registry.find(r => r.scenario_key === scenarioKey);
    } else if (legacyId) {
      item = resolveLegacyScenario(registry, legacyId);
    }

    const root = document.getElementById("scenarioPage");
    const startedAt = Date.now();

    if (!root || !item) {
      if (root) root.innerHTML = `<div class="scenario-card"><h1>Scenario not found</h1></div>`;
      return;
    }

    // Use registry item's ID as routing key, but evidence is grouped by category
    const key = item.id;
    const evidenceScenarioId = item.symptomCategory || key;
    const scenario = item.raw || item;


    const questionBank = normalizeQuestionBank(key, await loadScenarioQuestions(evidenceScenarioId));
    const approvedQuestionBank = questionBank.filter((q) => String(q.status || '').toLowerCase() === 'approved');
    const studentId = getStudentId();
    const state = readAttemptState(key, studentId);
    const failedHistory = state.history.filter((entry) => !entry.passed);

    const title =
      item.title ||
      scenario.title ||
      scenario.trainingFocus ||
      scenario.symptoms ||
      key;

    if (!state.activeAttempt) {
      // If there are enough approved questions, create a graded attempt
      if (approvedQuestionBank.length >= QUESTIONS_PER_ATTEMPT) {
        const previousQuestionIds = failedHistory
          .flatMap((entry) => Array.isArray(entry.questionIds) ? entry.questionIds : []);

        const nextAttemptNumber = state.history.length + 1;
        state.activeAttempt = createAttempt({
          questionBank: approvedQuestionBank,
          failedAttempts: failedHistory.length,
          previousQuestionIds,
          attemptNumber: nextAttemptNumber
        });
        writeAttemptState(key, studentId, state);
      } else {
        const missingCount = Math.max(0, QUESTIONS_PER_ATTEMPT - approvedQuestionBank.length);

        root.innerHTML = `
    <section class="scenario-hero">
      <div class="scenario-label">
        Scenario ${escapeHtml(scenario.id || item.numericId || "")}
      </div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(scenario.symptoms || item.shortSymptom || "")}</p>
      <p class="note">
        <strong>Topic:</strong>
        ${escapeHtml(
          scenario.trainingFocus ||
          item.category ||
          "Diagnostic training"
        )}
      </p>
    </section>

    <section class="scenario-card">
      <h2>Systems Involved</h2>
      <ul>
        <li>
          ${escapeHtml(
            scenario.primarySystem ||
            item.category ||
            "General"
          )}
        </li>
        ${(scenario.secondarySystems || [])
          .map((system) => `<li>${escapeHtml(system)}</li>`)
          .join("")}
      </ul>
    </section>

    <section class="scenario-card">
      <h2>Recommended Tools</h2>
      <ul>
        ${(scenario.requiredTools || [
          "Scan Tool",
          "Visual Inspection"
        ])
          .map((tool) => `<li>${escapeHtml(tool)}</li>`)
          .join("")}
      </ul>
    </section>

    <section class="scenario-card">
      <h2>Questions</h2>

      <div id="attemptSummary" class="attempt-summary">
        <p>
          <strong>Question bank unavailable for grading.</strong>
        </p>
        <p>
          This module currently has
          ${approvedQuestionBank.length}
          approved questions. It needs
          ${missingCount}
          more approved questions before a
          ${QUESTIONS_PER_ATTEMPT}-question graded attempt can begin.
        </p>
      </div>

      ${
        questionBank.length
          ? `
            <details>
              <summary>
                View ${questionBank.length} draft question records
              </summary>
              <p>
                Draft questions are visible for development only and
                are not used for grading.
              </p>
              <ul>
                ${questionBank
                  .map(
                    (question) => `
                      <li>
                        ${escapeHtml(
                          question.question_text ||
                          question.id ||
                          "Untitled question"
                        )}
                        <em>
                          status:
                          ${escapeHtml(question.status || "draft")}
                        </em>
                      </li>
                    `
                  )
                  .join("")}
              </ul>
            </details>
          `
          : `
            <p>
              No questions have been added for this module.
            </p>
          `
      }
    </section>
  `;

        return;
      }
    }

    // If no approved attempt could be created, render a clear warning and list available (draft) questions for development.
    if (!state.activeAttempt) {
      const summary = root.querySelector('#attemptSummary');
      if (summary) {
        summary.hidden = false;
        summary.innerHTML = `<p><strong>Question bank warning:</strong> only ${approvedQuestionBank.length} approved questions were found for this module. Add at least ${Math.max(0, QUESTIONS_PER_ATTEMPT - approvedQuestionBank.length)} more approved questions to reliably serve ${QUESTIONS_PER_ATTEMPT} graded items.</p>`;
      }

      // Render available (draft) questions for authorship/dev visibility but do not allow grading.
      const draftQuestions = questionBank;
      root.querySelector('.scenario-card:nth-of-type(4)')?.querySelector('#attemptSummary')?.insertAdjacentHTML('afterend',
        `<div class="scenario-card"><h3>Available Questions (development)</h3><p>Only approved questions are used for graded attempts.</p><ul>${draftQuestions.map(q=>`<li>${escapeHtml(q.question_text || q.id || '')} <em>status: ${escapeHtml(q.status||'')}</em></li>`).join('')}</ul></div>`
      );

      return;
    }

    const questionMap = new Map(approvedQuestionBank.map((q) => [q.__qid, q]));
    const questions = state.activeAttempt.questionIds
      .map((idValue) => questionMap.get(idValue))
      .filter(Boolean);

    if (questions.length !== state.activeAttempt.questionIds.length) {
      state.activeAttempt = createAttempt({
        questionBank: approvedQuestionBank,
        failedAttempts: failedHistory.length,
        previousQuestionIds: failedHistory.flatMap((entry) => Array.isArray(entry.questionIds) ? entry.questionIds : []),
        attemptNumber: state.history.length + 1
      });
      writeAttemptState(key, studentId, state);
    }

    const resolvedQuestions = state.activeAttempt.questionIds
      .map((idValue) => questionMap.get(idValue))
      .filter(Boolean);

    

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
        <p class="note">Attempt ${state.activeAttempt.attemptNumber}. Target: ${QUESTIONS_PER_ATTEMPT} questions per attempt.</p>
        ${
          resolvedQuestions.length
            ? resolvedQuestions.map((q, i) => {
              const answer = state.activeAttempt.answers[q.__qid] || null;
              const disabled = answer ? "disabled" : "";
              const checked = (choice) => (answer && answer.selectedAnswer === choice ? "checked" : "");
              return `
                <article
                  class="question-card"
                  data-question-text="${escapeHtml(q.question_text)}"
                  data-topic="${escapeHtml(q.topic || "")}"
                  data-question-qid="${escapeHtml(q.__qid)}"
                >
                  <h3>Question ${i + 1}</h3>
                  <p>${escapeHtml(q.question_text)}</p>

                  <div
                    class="question-options"
                    data-question-id="${escapeHtml(q.id || "")}"
                  >
                    <label class="question-option">
                      <input type="radio" name="q${i}" value="A" ${checked("A")} ${disabled}>
                      A. ${escapeHtml(q.option_a)}
                    </label>

                    <label class="question-option">
                      <input type="radio" name="q${i}" value="B" ${checked("B")} ${disabled}>
                      B. ${escapeHtml(q.option_b)}
                    </label>

                    <label class="question-option">
                      <input type="radio" name="q${i}" value="C" ${checked("C")} ${disabled}>
                      C. ${escapeHtml(q.option_c)}
                    </label>

                    <label class="question-option">
                      <input type="radio" name="q${i}" value="D" ${checked("D")} ${disabled}>
                      D. ${escapeHtml(q.option_d)}
                    </label>
                  </div>

                  <button class="submit-answer" type="button" ${disabled}>
                    Submit Answer
                  </button>

                  <p class="answer-feedback" aria-live="polite">${answer ? (answer.isCorrect ? "Correct." : "Incorrect.") : ""}</p>

                  <div class="torquemind-feedback" hidden>
                    <h4>🧠 TorqueMind AI Tutor</h4>
                    <div class="torquemind-body">
                      Generating explanation...
                    </div>
                  </div>

                  <p><strong>Topic:</strong> ${escapeHtml(q.topic)}</p>
                </article>
              `;
            }).join("")
            : `<p>No structured questions added yet for this scenario.</p>`
        }
        <div id="attemptSummary" class="attempt-summary" hidden></div>
      </section>
    `;

    if (questionBank.length < QUESTIONS_PER_ATTEMPT) {
      const summary = root.querySelector("#attemptSummary");
      if (summary) {
        summary.hidden = false;
        summary.innerHTML = `<p><strong>Question bank warning:</strong> only ${questionBank.length} unique questions were found for this module. Add more questions to reliably serve ${QUESTIONS_PER_ATTEMPT} unique items.</p>`;
      }
    }

    const summaryEl = root.querySelector("#attemptSummary");

    root.querySelectorAll(".submit-answer").forEach((button) => {
      button.addEventListener("click", async () => {
        const article = button.closest("article");
        const options = article.querySelector(".question-options");
        const feedback = article.querySelector(".answer-feedback");
        const selected = article.querySelector("input[type='radio']:checked");
        const questionQid = article.dataset.questionQid || "";

        if (!selected) {
          feedback.textContent = "Select an answer first.";
          return;
        }

        button.disabled = true;
        article.querySelectorAll("input[type='radio']").forEach((input) => {
          input.disabled = true;
        });

        try {
          // Call server-side grading endpoint
          const gradeResult = await submitAnswerForGrading({
            attemptId: attemptId,
            questionId: options.dataset.questionId || questionQid,
            scenarioId: key,
            selectedAnswer: selected.value,
            isAssessmentMode
          });

          // Store grading result from server
          state.activeAttempt.answers[questionQid] = {
            selectedAnswer: selected.value,
            submittedAt: new Date().toISOString(),
            // In assessment mode, is_correct is not returned (no immediate feedback)
            // In training mode, is_correct is returned for immediate feedback
            isCorrect: gradeResult.is_correct !== undefined ? gradeResult.is_correct : null,
            submissionId: gradeResult.question_id
          };
          writeAttemptState(key, studentId, state);

          // Show appropriate feedback based on mode
          if (isAssessmentMode) {
            // Assessment mode: never show correctness
            feedback.textContent = "Submitted.";
          } else {
            // Training mode: show correctness and explanations
            feedback.textContent = gradeResult.is_correct
              ? "Correct."
              : "Incorrect.";

            // In training mode, load AI explanation if answer is wrong
            if (!gradeResult.is_correct && gradeResult.explanation) {
              await loadTorqueMindExplanation({
                article,
                title,
                selected,
                explanation: gradeResult.explanation,
                isAssessmentMode: false
              });
            }
          }

          // Audit trail is recorded server-side by grading endpoint
        } catch (err) {
          console.error("Error submitting answer:", err);
          feedback.textContent = "Error submitting answer. Please try again.";
          button.disabled = false;
          article.querySelectorAll("input[type='radio']").forEach((input) => {
            input.disabled = false;
          });
          return;
        }

        // Check if all questions answered
        const answeredCount = Object.keys(state.activeAttempt.answers).length;
        const totalQuestions = state.activeAttempt.questionIds.length;
        if (answeredCount >= totalQuestions) {
          // Calculate score from server-provided grading results
          const correctCount = Object.values(state.activeAttempt.answers || {})
            .filter((a) => a && a.isCorrect).length;
          const score = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);
          const passed = score >= PASSING_SCORE_PERCENT;

          const entry = buildAttemptHistoryEntry({
            moduleId: key,
            studentId,
            activeAttempt: state.activeAttempt,
            score,
            passed
          });

          state.history.push(entry);
          state.activeAttempt = null;
          writeAttemptState(key, studentId, state);

          renderAttemptSummary(summaryEl, {
            attemptNumber: entry.attemptNumber,
            score: entry.score,
            passed: entry.passed,
            correctCount,
            totalQuestions
          });

          await saveAttemptSummary(entry);

          const restartBtn = document.createElement("button");
          restartBtn.type = "button";
          restartBtn.className = "submit-answer";
          restartBtn.textContent = "Start Next Attempt";
          restartBtn.addEventListener("click", () => {
            location.reload();
          });
          summaryEl.appendChild(restartBtn);
        }
      });
    });
  }

  renderScenarioPage();
})();
