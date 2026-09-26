const POLICY_URL = "/data/curriculum/content-policy.json";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

function titleCase(value) {
  return String(value)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function loadPolicy() {
  const response = await fetch(POLICY_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load curriculum content policy: ${response.status}`);
  return response.json();
}

function renderVisualTypes(policy) {
  const target = document.querySelector("#visual-types");
  target.innerHTML = policy.visualTypes.map((visual, index) => `
    <article class="standard-card">
      <span class="standard-number">${String(index + 1).padStart(2, "0")}</span>
      <h3>${escapeHtml(titleCase(visual.type))}</h3>
      <p>${escapeHtml(visual.purpose)}</p>
      ${visual.requiresWholePartRationale
        ? '<strong class="standard-note">Whole-part rationale required</strong>'
        : ""}
    </article>
  `).join("");
}
function renderCoreRules(policy) {
  document.querySelector("#core-rules").innerHTML = policy.coreRules.map((item) => `
    <li><span>${escapeHtml(titleCase(item.id))}</span><p>${escapeHtml(item.rule)}</p></li>
  `).join("");
}

function renderLessonStructure(policy) {
  document.querySelector("#lesson-structure").innerHTML = policy.lessonStructure.map((step) =>
    `<li>${escapeHtml(titleCase(step))}</li>`
  ).join("");
}

function renderGovernance(policy) {
  document.querySelector("#governance-rules").innerHTML = policy.governanceRules.map((rule) =>
    `<li>${escapeHtml(rule)}</li>`
  ).join("");
}

async function init() {
  try {
    const policy = await loadPolicy();
    renderVisualTypes(policy);
    renderCoreRules(policy);
    renderLessonStructure(policy);
    renderGovernance(policy);
    document.documentElement.dataset.curriculumStandards = "loaded";
  } catch (error) {
    console.error(error);
    document.documentElement.dataset.curriculumStandards = "error";
    document.querySelector("#visual-types").innerHTML =
      '<div class="pathway-load-error">Curriculum standards are temporarily unavailable.</div>';
  }
}

init();
