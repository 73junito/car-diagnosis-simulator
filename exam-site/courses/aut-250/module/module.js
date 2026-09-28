const CURRICULUM_URL = "/data/curriculum/lesson-content.json";
const APPROVAL_URL = "/data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

function approvalIsValid(approval) {
  const effect = approval?.approval_effect_if_confirmed;
  const release = approval?.release_state;
  const decision = approval?.requested_final_decision;
  return [
    approval?.course_id === "AUT-250",
    approval?.lesson_plan_id === "ug-hev-foundations",
    approval?.question_count === 20,
    decision?.decision === "approved",
    decision?.scope === "training-bank-final-approval-only",
    release?.training_bank_final_approval === "approved-for-training-use",
    effect?.training_delivery_allowed === true,
    effect?.scored === false,
    effect?.high_stakes_eligible === false,
    effect?.institutional_assessment_eligible === false,
    effect?.production_assessment_api_eligible === false,
    release?.production_release === false,
    release?.assessment_release === false,
    release?.high_stakes_release === false
  ].every(Boolean);
}

function moduleIdFromUrl() {
  return new URLSearchParams(window.location.search).get("module") || "aut250-m1-battery-systems";
}

function renderQuestion(state) {
  const question = state.questions[state.index];
  document.querySelector("[data-question-position]").textContent = `Question ${state.index + 1} of ${state.questions.length}`;
  document.querySelector("[data-question-progress]").style.width = `${((state.index + 1) / state.questions.length) * 100}%`;
  document.querySelector("[data-question-topic]").textContent = String(question.topic || "Training question").replace(/-/g, " ").toUpperCase();
  document.querySelector("[data-question-stem]").textContent = question.stem;

  const options = document.querySelector("[data-question-options]");
  options.innerHTML = Object.entries(question.choices || {}).map(([letter, label]) => `
    <label class="aut250-player-option">
      <input type="radio" name="guided-question" value="${escapeHtml(letter)}">
      <span><strong>${escapeHtml(letter)}.</strong> ${escapeHtml(label)}</span>
    </label>`).join("");

  document.querySelector("[data-question-feedback]").innerHTML = "";
  document.querySelector("[data-retry-answer]").hidden = true;
  document.querySelector("[data-submit-answer]").disabled = false;
  document.querySelector("[data-prev-question]").disabled = state.index === 0;
  document.querySelector("[data-next-question]").textContent =
    state.index === state.questions.length - 1 ? "Finish module" : "Next question";
}

function checkAnswer(state) {
  const question = state.questions[state.index];
  const selected = document.querySelector('input[name="guided-question"]:checked');
  const feedback = document.querySelector("[data-question-feedback]");
  if (!selected) {
    feedback.textContent = "Choose an answer before checking.";
    return;
  }

  const correct = selected.value === question.answer;
  feedback.innerHTML = `
    <strong>${correct ? "Correct." : "Not yet."}</strong>
    <p>${escapeHtml(question.explanation)}</p>
    <p class="training-boundary">Reasoning feedback only. This does not authorize a vehicle service action.</p>`;

  document.querySelector("[data-submit-answer]").disabled = true;
  document.querySelector("[data-retry-answer]").hidden = correct;
}

function retryAnswer() {
  document.querySelectorAll('input[name="guided-question"]').forEach((input) => {
    input.checked = false;
  });
  document.querySelector("[data-question-feedback]").innerHTML = "";
  document.querySelector("[data-submit-answer]").disabled = false;
  document.querySelector("[data-retry-answer]").hidden = true;
}

async function init() {
  try {
    const [approval, curriculum] = await Promise.all([loadJson(APPROVAL_URL), loadJson(CURRICULUM_URL)]);
    if (!approvalIsValid(approval)) throw new Error("AUT-250 training approval gate not satisfied");

    const plan = curriculum.lessonContentPlans?.find((item) => item.lessonPlanId === "ug-hev-foundations");
    const module = plan?.courseModules?.find((item) => item.id === moduleIdFromUrl());
    if (!module) throw new Error("Requested AUT-250 module not found");
    const questions = module.trainingQuestions || [];
    if (!questions.length) throw new Error("Requested module has no approved training questions");
    if (!questions.every((question) => question.scored === false && question.highStakesEligible === false && question.deliveryMode === "training")) {
      throw new Error("Question boundary violation");
    }

    document.documentElement.dataset.aut250PlayerRelease = "approved-for-training-use";
    document.querySelector("[data-player-module-label]").textContent = `Module ${String(module.sequence).padStart(2, "0")}`;
    document.querySelector("[data-player-eyebrow]").textContent = `AUT-250 · MODULE ${String(module.sequence).padStart(2, "0")} · FORMATIVE TRAINING`;
    document.querySelector("[data-player-title]").textContent = module.title;
    document.querySelector("[data-player-objective]").textContent = module.moduleObjectives?.[0] || "";

    const state = { questions, index: 0 };
    const player = document.querySelector("[data-question-player]");
    player.hidden = false;
    renderQuestion(state);

    document.querySelector("[data-submit-answer]").addEventListener("click", () => checkAnswer(state));
    document.querySelector("[data-retry-answer]").addEventListener("click", retryAnswer);
    document.querySelector("[data-prev-question]").addEventListener("click", () => {
      if (state.index > 0) {
        state.index -= 1;
        renderQuestion(state);
      }
    });
    document.querySelector("[data-next-question]").addEventListener("click", () => {
      if (state.index < state.questions.length - 1) {
        state.index += 1;
        renderQuestion(state);
      } else {
        window.location.href = "/courses/aut-250/";
      }
    });
  } catch (error) {
    console.error("AUT-250 guided question player failed closed:", error);
    document.documentElement.dataset.aut250PlayerRelease = "blocked";
    document.querySelector("#player-gate-blocked").hidden = false;
    document.querySelector("[data-question-player]").hidden = true;
  }
}

init();
