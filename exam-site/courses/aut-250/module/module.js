import { renderModuleVisuals, setModuleVisualReasoningStep } from "./module-visuals.js";
import { getDistractorFeedback } from "./distractor-feedback.js";

const CURRICULUM_URL = "/data/curriculum/lesson-content.json";
const APPROVAL_URL = "/data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json";
const BATCH002_APPROVAL_URL = "/data/evidence/approval-records/aut250-training-batch-002-final-approval-20260928.json";
const BATCH002_CURRICULUM_URL = "/data/curriculum/aut250-training-batch-002.json";
const STORAGE_KEY = "autolearnpro:aut250:module-progress";
const PROGRESS_VERSION = 2;

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

function approvalIsValid(approval, expectedBatch) {
  const effect = approval?.approval_effect_if_confirmed;
  const release = approval?.release_state;
  const decision = approval?.requested_final_decision;
  return [
    approval?.course_id === "AUT-250",
    approval?.question_batch === expectedBatch,
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


function mergeBatch002IntoModule(module, supplement) {
  const supplementalModule = supplement?.modules?.find((item) => item.moduleId === module.id);
  const questions = supplementalModule?.questions || [];
  const boundaryOk = supplement?.questionBatch === "aut250-training-batch-002-ollama-repaired" &&
    supplement?.questionCount === 20 && questions.every((question) =>
      question.status === "approved-for-training-use" &&
      question.deliveryMode === "training" &&
      question.scored === false &&
      question.highStakesEligible === false &&
      question.institutionalAssessmentEligible === false &&
      question.productionAssessmentApiEligible === false
    );
  if (!boundaryOk) throw new Error("AUT-250 Batch 002 supplemental bank failed validation");
  const existing = new Set((module.trainingQuestions || []).map((question) => question.id));
  module.trainingQuestions = [...(module.trainingQuestions || []), ...questions.filter((question) => !existing.has(question.id))];
  return module;
}

function renderEvidenceDrawer(approval, module) {
  const prereq = approval?.prerequisite_state || {};
  const effect = approval?.approval_effect_if_confirmed || {};
  const release = approval?.release_state || {};
  const limitations = approval?.limitations || [];
  const questionMetadata = (module.trainingQuestions || []).map((question) => ({
    id: question.id,
    topic: question.topic,
    authorship: question.authorship,
    deliveryMode: question.deliveryMode,
    scored: question.scored,
    highStakesEligible: question.highStakesEligible
  }));

  return `
    <section class="evidence-drawer-section">
      <h3>Training authorization</h3>
      <dl class="evidence-fact-grid">
        <div><dt>Training status</dt><dd>${release.training_bank_final_approval === "approved-for-training-use" ? "Approved for training use" : "Not approved"}</dd></div>
        <div><dt>Citation representation</dt><dd>${prereq.citation_representation === "metadata-only-citation-proof" ? "Metadata-only citation proof" : escapeHtml(prereq.citation_representation)}</dd></div>
        <div><dt>Deterministic validation</dt><dd>${prereq.deterministic_metadata_validation === "valid" ? "Valid" : escapeHtml(prereq.deterministic_metadata_validation)}</dd></div>
        <div><dt>Validated questions</dt><dd>${escapeHtml(prereq.deterministic_questions_valid)} / ${escapeHtml(approval.question_count)}</dd></div>
      </dl>
      <p class="evidence-drawer-note">Metadata-only citation validation does not claim excerpt verification, source-text hash verification, or source-rights clearance.</p>
    </section>

    <section class="evidence-drawer-section">
      <h3>Human review gates</h3>
      <p>${prereq.human_reviews_complete ? `${(prereq.required_human_roles || []).length} / ${(prereq.required_human_roles || []).length} complete` : "Incomplete"}: ${(prereq.required_human_roles || []).map((role)=>escapeHtml(role)).join(" · ")}</p>
    </section>

    <section class="evidence-drawer-section">
      <h3>Module safety & evidence boundary</h3>
      <p>${escapeHtml(module.safetyAndEvidenceBoundary || "No module boundary supplied.")}</p>
    </section>

    <section class="evidence-drawer-section">
      <h3>Question metadata</h3>
      <div class="evidence-question-list">
        ${questionMetadata.map((item)=>`
          <article>
            <code>${escapeHtml(item.id)}</code>
            <strong>${escapeHtml(String(item.topic || "").replace(/-/g," "))}</strong>
            <span>${escapeHtml(item.authorship)} · ${escapeHtml(item.deliveryMode)} · non-scored · not high-stakes eligible</span>
          </article>`).join("")}
      </div>
      <p class="evidence-drawer-note">Answer keys are intentionally not shown in this instructor/evidence summary.</p>
    </section>

    <section class="evidence-drawer-section">
      <h3>Approval limitations</h3>
      <ul>${limitations.map((item)=>`<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <p><strong>Assessment API eligible:</strong> ${effect.production_assessment_api_eligible === false ? "No" : "Unexpected state"}</p>
    </section>

    <p class="evidence-drawer-note">Current release authority comes from the final AUT-250 approval credential. Historical workflow labels in curriculum metadata may describe earlier review stages and do not override that record.</p>
    <p><a href="/lesson-plans/#ug-hev-foundations">Open full curriculum view</a></p>`;
}

function initEvidenceDrawer(approval, module) {
  const drawer = document.querySelector("[data-evidence-drawer]");
  const content = document.querySelector("[data-evidence-drawer-content]");
  const openButton = document.querySelector("[data-evidence-drawer-open]");
  content.innerHTML = renderEvidenceDrawer(approval, module);
  openButton.hidden = false;

  openButton.addEventListener("click", () => {
    if (typeof drawer.showModal === "function") drawer.showModal();
    else drawer.setAttribute("open", "");
  });
  document.querySelector("[data-evidence-drawer-close]").addEventListener("click", () => {
    if (typeof drawer.close === "function") drawer.close();
    else drawer.removeAttribute("open");
  });
}

function emptyProgress() {
  return { version: PROGRESS_VERSION, lastModuleId: null, modules: {} };
}

function readProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (parsed?.version !== PROGRESS_VERSION || !parsed.modules) return emptyProgress();
    return parsed;
  } catch {
    return emptyProgress();
  }
}

function writeProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function moduleProgress(progress, moduleId) {
  const current = progress.modules?.[moduleId] || {};
  return {
    currentQuestionIndex: Number.isInteger(current.currentQuestionIndex) && current.currentQuestionIndex >= 0
      ? current.currentQuestionIndex : 0,
    attemptedQuestionIds: Array.isArray(current.attemptedQuestionIds) ? [...new Set(current.attemptedQuestionIds)] : [],
    feedbackViewedQuestionIds: Array.isArray(current.feedbackViewedQuestionIds) ? [...new Set(current.feedbackViewedQuestionIds)] : [],
    completed: current.completed === true,
    lastVisitedAt: typeof current.lastVisitedAt === "string" ? current.lastVisitedAt : null
  };
}

function saveModuleProgress(module, updater) {
  const progress = readProgress();
  progress.version = PROGRESS_VERSION;
  progress.modules = progress.modules || {};
  const current = moduleProgress(progress, module.id);
  const next = updater(current);
  const questionIds = (module.trainingQuestions || []).map((question) => question.id);
  next.completed = questionIds.length > 0 &&
    questionIds.every((id) => next.attemptedQuestionIds.includes(id)) &&
    questionIds.every((id) => next.feedbackViewedQuestionIds.includes(id));
  next.lastVisitedAt = new Date().toISOString();
  progress.modules[module.id] = next;
  progress.lastModuleId = module.id;
  writeProgress(progress);
  return next;
}

function requestedQuestionIndex(questionCount) {
  const raw = Number(new URLSearchParams(window.location.search).get("question"));
  if (!Number.isInteger(raw) || raw < 1) return null;
  return Math.min(raw - 1, Math.max(questionCount - 1, 0));
}

function reasoningStepForQuestion(question) {
  const topic = String(question?.topic || "").toLowerCase();
  if (topic.includes("verification") || topic.includes("post-repair")) return "verify";
  if (topic.includes("correlation") || topic.includes("hypoth") || topic.includes("dependencies") || topic.includes("boundaries")) return "correlate";
  if (topic.includes("compare") || topic.includes("interpretation") || topic.includes("estimation") || topic.includes("command-response") || topic.includes("readiness") || topic === "diagnostic-process") return "compare";
  if (topic.includes("request") || topic.includes("concern")) return "request";
  return "measure";
}

const REASONING_TAKEAWAYS = {
  request: "Define the concern or requested state before deciding what evidence matters.",
  measure: "Preserve observed evidence before moving from observation to explanation.",
  compare: "Compare the evidence with applicable authoritative information and expected context.",
  correlate: "Relate evidence across systems and conditions before naming a cause.",
  verify: "Confirm the conclusion under relevant conditions before closing the reasoning loop."
};

function setActiveReasoningStep(step) {
  document.querySelectorAll("[data-reasoning-step]").forEach((item) => {
    const active = item.dataset.reasoningStep === step;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  const focus = document.querySelector("[data-question-reasoning-focus]");
  if (focus) focus.textContent = step.charAt(0).toUpperCase() + step.slice(1);
  setModuleVisualReasoningStep(step);
}

function moduleIdFromUrl() {
  return new URLSearchParams(window.location.search).get("module") || "aut250-m1-battery-systems";
}

function renderQuestion(state) {
  const question = state.questions[state.index];
  const step = reasoningStepForQuestion(question);
  setActiveReasoningStep(step);

  document.querySelector("[data-question-position]").textContent =
    `Module ${String(state.module.sequence).padStart(2, "0")} · Question ${state.index + 1} of ${state.questions.length}`;
  document.querySelector("[data-question-progress]").style.width =
    `${((state.index + 1) / state.questions.length) * 100}%`;
  document.querySelector("[data-question-topic]").textContent =
    String(question.topic || "Training question").replace(/-/g, " ").toUpperCase();
  document.querySelector("[data-question-stem]").textContent = question.stem;

  const attempted = state.progress.attemptedQuestionIds.includes(question.id);
  document.querySelector("[data-question-attempt-status]").textContent =
    attempted ? "Previously attempted" : "Not attempted";

  const options = document.querySelector("[data-question-options]");
  options.innerHTML = Object.entries(question.choices || {}).map(([letter, label]) => `
    <label class="aut250-player-option">
      <input type="radio" name="guided-question" value="${escapeHtml(letter)}">
      <span><strong>${escapeHtml(letter)}.</strong> ${escapeHtml(label)}</span>
    </label>`).join("");

  const submit = document.querySelector("[data-submit-answer]");
  submit.disabled = true;
  options.querySelectorAll('input[name="guided-question"]').forEach((input) => {
    input.addEventListener("change", () => {
      submit.disabled = false;
    });
  });

  document.querySelector("[data-question-feedback]").innerHTML = "";
  document.querySelector("[data-retry-answer]").hidden = true;
  document.querySelector("[data-prev-question]").disabled = state.index === 0;

  const next = document.querySelector("[data-next-question]");
  next.textContent = state.index === state.questions.length - 1 ? "Finish module" : "Next question";
  next.disabled = !attempted;

  saveModuleProgress(state.module, (progress) => ({
    ...progress,
    currentQuestionIndex: state.index
  }));
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
  const step = reasoningStepForQuestion(question);
  state.progress = saveModuleProgress(state.module, (progress) => ({
    ...progress,
    attemptedQuestionIds: [...new Set([...progress.attemptedQuestionIds, question.id])],
    feedbackViewedQuestionIds: [...new Set([...progress.feedbackViewedQuestionIds, question.id])],
    currentQuestionIndex: state.index
  }));

  const distractorFeedback = getDistractorFeedback(question.id, question.answer);
  const distractorItems = Object.entries(distractorFeedback).map(([letter, rationale]) => `
    <li><strong>${escapeHtml(letter)}.</strong> ${escapeHtml(rationale)}</li>`).join("");

  feedback.innerHTML = `
    <div class="aut250-feedback-grid">
      <div><span>Result</span><strong>${correct ? "Correct" : "Try again"}</strong></div>
      <div><span>Why</span><p>${escapeHtml(question.explanation)}</p></div>
      <div><span>Diagnostic takeaway</span><p>${escapeHtml(REASONING_TAKEAWAYS[step])}</p></div>
    </div>
    ${distractorItems ? `
      <details class="aut250-distractor-feedback">
        <summary>Why the other choices are weaker</summary>
        <ul>${distractorItems}</ul>
      </details>` : ""}
    <p class="training-boundary">Reasoning feedback only. This does not authorize a vehicle service action.</p>`;

  document.querySelector("[data-question-attempt-status]").textContent = "Attempted";
  document.querySelector("[data-submit-answer]").disabled = true;
  document.querySelector("[data-retry-answer]").hidden = correct;
  document.querySelector("[data-next-question]").disabled = false;
}

function retryAnswer() {
  document.querySelectorAll('input[name="guided-question"]').forEach((input) => {
    input.checked = false;
  });
  document.querySelector("[data-question-feedback]").innerHTML = "";
  document.querySelector("[data-submit-answer]").disabled = true;
  document.querySelector("[data-retry-answer]").hidden = true;
  const first = document.querySelector('input[name="guided-question"]');
  if (first) first.focus();
}

function uniqueReasoningSteps(questions, progress) {
  const attempted = new Set(progress.attemptedQuestionIds || []);
  return [...new Set(
    questions
      .filter((question) => attempted.has(question.id))
      .map((question) => reasoningStepForQuestion(question))
  )];
}

function showModuleCompletion(state) {
  const section = document.querySelector("[data-module-completion]");
  const questionIds = state.questions.map((question) => question.id);
  const attemptedCount = questionIds.filter((id) => state.progress.attemptedQuestionIds.includes(id)).length;
  const feedbackCount = questionIds.filter((id) => state.progress.feedbackViewedQuestionIds.includes(id)).length;
  const complete = state.progress.completed === true;
  const steps = uniqueReasoningSteps(state.questions, state.progress);
  const firstIncomplete = state.questions.findIndex((question) =>
    !state.progress.attemptedQuestionIds.includes(question.id) ||
    !state.progress.feedbackViewedQuestionIds.includes(question.id)
  );

  document.querySelector("[data-question-player]").hidden = true;
  section.hidden = false;

  document.querySelector("[data-module-completion-title]").textContent =
    complete ? `Module ${String(state.module.sequence).padStart(2, "0")} complete` : "Module still in progress";
  document.querySelector("[data-module-completion-message]").textContent =
    complete
      ? "You attempted every formative question and viewed the feedback for this module."
      : "Some formative questions still need an attempt and feedback review before this module is complete.";
  document.querySelector("[data-completion-attempted]").textContent = `${attemptedCount} / ${state.questions.length}`;
  document.querySelector("[data-completion-feedback]").textContent = `${feedbackCount} / ${state.questions.length}`;
  document.querySelector("[data-completion-status]").textContent = complete ? "Complete" : "In progress";
  document.querySelector("[data-completion-reasoning]").textContent =
    steps.length ? steps.map((step) => step.charAt(0).toUpperCase() + step.slice(1)).join(" · ") : "No reasoning steps recorded yet";

  const review = document.querySelector("[data-review-module]");
  review.href = `/courses/aut-250/module/?module=${encodeURIComponent(state.module.id)}&question=1`;

  const next = document.querySelector("[data-continue-module]");
  if (complete && state.nextModule) {
    next.textContent = `Continue to Module ${String(state.nextModule.sequence).padStart(2, "0")}`;
    next.href = `/courses/aut-250/module/?module=${encodeURIComponent(state.nextModule.id)}&question=1`;
  } else if (complete) {
    next.textContent = "Return to AUT-250 dashboard";
    next.href = "/courses/aut-250/";
  } else {
    next.textContent = "Continue incomplete questions";
    next.href = `/courses/aut-250/module/?module=${encodeURIComponent(state.module.id)}&question=${Math.max(firstIncomplete + 1, 1)}`;
  }

  section.scrollIntoView({ behavior: "smooth", block: "start" });
  section.focus?.({ preventScroll: true });
}

async function init() {
  try {
    const [approval, batch002Approval, curriculum, batch002Supplement] = await Promise.all([
      loadJson(APPROVAL_URL),
      loadJson(BATCH002_APPROVAL_URL),
      loadJson(CURRICULUM_URL),
      loadJson(BATCH002_CURRICULUM_URL)
    ]);
    if (!approvalIsValid(approval, "aut250-training-batch-001") ||
        !approvalIsValid(batch002Approval, "aut250-training-batch-002-ollama-repaired")) {
      throw new Error("AUT-250 training approval gate not satisfied");
    }

    const plan = curriculum.lessonContentPlans?.find((item) => item.lessonPlanId === "ug-hev-foundations");
    const module = plan?.courseModules?.find((item) => item.id === moduleIdFromUrl());
    if (module) mergeBatch002IntoModule(module, batch002Supplement);
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
    initEvidenceDrawer(approval, module);

    const objectives = document.querySelector("[data-learning-objectives]");
    objectives.innerHTML = (module.moduleObjectives || []).map((objective) =>
      `<li>${escapeHtml(objective)}</li>`
    ).join("");
    document.querySelector("[data-learning-summary]").hidden = false;

    const visualGrid = document.querySelector("[data-module-visual-grid]");
    visualGrid.innerHTML = renderModuleVisuals(module.visuals || []);
    document.querySelector("[data-visual-section]").hidden = false;

    const storedProgress = readProgress();
    const saved = moduleProgress(storedProgress, module.id);
    const requestedIndex = requestedQuestionIndex(questions.length);
    const moduleIndex = plan.courseModules.findIndex((item) => item.id === module.id);
    const state = {
      module,
      nextModule: moduleIndex >= 0 ? plan.courseModules[moduleIndex + 1] || null : null,
      questions,
      progress: saved,
      index: requestedIndex ?? Math.min(saved.currentQuestionIndex, questions.length - 1)
    };
    state.progress = saveModuleProgress(module, (progress) => ({
      ...progress,
      currentQuestionIndex: state.index
    }));
    const player = document.querySelector("[data-question-player]");
    player.hidden = false;
    renderQuestion(state);

    document.querySelector("[data-submit-answer]").addEventListener("click", () => checkAnswer(state));
    document.querySelector("[data-retry-answer]").addEventListener("click", retryAnswer);
    document.querySelector("[data-prev-question]").addEventListener("click", () => {
      if (state.index > 0) {
        state.index -= 1;
        state.progress = saveModuleProgress(module, (progress) => ({
          ...progress,
          currentQuestionIndex: state.index
        }));
        renderQuestion(state);
        document.querySelector("[data-question-card]").focus({ preventScroll: true });
      }
    });
    document.querySelector("[data-next-question]").addEventListener("click", () => {
      if (document.querySelector("[data-next-question]").disabled) return;
      if (state.index < state.questions.length - 1) {
        state.index += 1;
        state.progress = saveModuleProgress(module, (progress) => ({
          ...progress,
          currentQuestionIndex: state.index
        }));
        renderQuestion(state);
        document.querySelector("[data-question-card]").focus({ preventScroll: true });
      } else {
        state.progress = saveModuleProgress(module, (progress) => ({
          ...progress,
          currentQuestionIndex: state.index
        }));
        showModuleCompletion(state);
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
