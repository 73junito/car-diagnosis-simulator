const ROOT = "/data/curriculum";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const titleCase = (value) => String(value ?? "")
  .split(/[-_]/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

async function loadJson(name) {
  const response = await fetch(`${ROOT}/${name}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${name}: ${response.status}`);
  return response.json();
}

function list(items, className = "") {
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderObjectives(objectives) {
  return objectives.map((objective, index) => `
    <li>
      <span class="objective-number">${String(index + 1).padStart(2, "0")}</span>
      <div><strong>${escapeHtml(titleCase(objective.cognitiveLevel))}</strong><p>${escapeHtml(objective.statement)}</p></div>
    </li>`
  ).join("");
}

function renderEvidenceReferences(references = []) {
  if (!references.length) return "";
  return `
    <div class="lesson-evidence-refs">
      <strong>Evidence references</strong>
      <ul>${references.map((ref) => {
        const details = [
          ref.value,
          ref.comparisonRole ? titleCase(ref.comparisonRole) : "",
          ref.applicability,
          ref.locator,
          ref.approval
        ].filter(Boolean).join(" · ");
        return `<li><code>${escapeHtml(ref.id || ref.sourceId || ref.type)}</code>${details ? `<span>${escapeHtml(details)}</span>` : ""}</li>`;
      }).join("")}</ul>
    </div>`;
}

function renderIndependentCases(cases = []) {
  if (!cases.length) return "";
  return `
    <div class="independent-case-grid">
      ${cases.map((caseItem) => `
        <article class="independent-case">
          <span class="case-role">${escapeHtml(titleCase(caseItem.evidenceRole))}</span>
          <h5>${escapeHtml(caseItem.title)}</h5>
          <p><strong>Concern:</strong> ${escapeHtml(caseItem.concern)}</p>
          <div><strong>Operating context</strong>${list(caseItem.operatingContext || [], "case-context")}</div>
          <div class="case-observations">
            <strong>Raw observations</strong>
            <ul>
              ${(caseItem.observations || []).map((observation) => `
                <li>
                  <code>${escapeHtml(observation.testPoint)}</code>
                  <span>${escapeHtml(observation.measurementType)} · ${escapeHtml(observation.value)}</span>
                  <small>${escapeHtml(observation.meaning)}</small>
                </li>`).join("")}
            </ul>
          </div>
          <div><strong>Unknowns to resolve</strong>${list(caseItem.unknownsToResolve || [], "case-unknowns")}</div>
          <p class="learner-action"><strong>Student prompt:</strong> ${escapeHtml(caseItem.studentPrompt)}</p>
        </article>`).join("")}
    </div>`;
}

function renderBlocks(blocks) {
  return blocks.map((block, index) => `
    <li>
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>${escapeHtml(block.title)}</strong>
        <p>${escapeHtml(block.description)}</p>
        <small>${escapeHtml(titleCase(block.instructionalPurpose))}</small>
        ${block.teachingPoints?.length ? `<ul class="lesson-teaching-points">${block.teachingPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>` : ""}
        ${block.learnerAction ? `<p class="learner-action"><strong>Learner task:</strong> ${escapeHtml(block.learnerAction)}</p>` : ""}
        ${renderIndependentCases(block.independentCases)}
        ${block.sourceBoundary ? `<p class="source-boundary"><strong>Boundary:</strong> ${escapeHtml(block.sourceBoundary)}</p>` : ""}
        ${renderEvidenceReferences(block.evidenceReferences)}
      </div>
    </li>`
  ).join("");
}

function renderVisuals(visuals) {
  return visuals.map((visual) => `
    <article>
      <span>${escapeHtml(titleCase(visual.type))}</span>
      <h4>${escapeHtml(visual.title)}</h4>
      <p>${escapeHtml(visual.purpose)}</p>
      ${visual.content?.length ? `<ul class="visual-content">${visual.content.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${visual.altText ? `<p class="visual-alt"><strong>Accessibility:</strong> ${escapeHtml(visual.altText)}</p>` : ""}
      ${visual.sourceScope ? `<p class="source-boundary"><strong>Source scope:</strong> ${escapeHtml(visual.sourceScope)}</p>` : ""}
    </article>`
  ).join("");
}


const AUT250_VISUAL_MODELS = {
  "Battery-system functional architecture": {
    kind: "nodes",
    nodes: ["Cells / Modules", "Sensors", "Switching", "Protection", "Control", "Thermal"],
    links: [["Cells / Modules","Sensors"],["Sensors","Control"],["Control","Switching"],["Protection","Switching"],["Thermal","Control"]]
  },
  "Measured, calculated, commanded, and inferred battery data": {
    kind: "table",
    headers: ["Category", "Examples", "Interpretation"],
    rows: [
      ["Measured", "Voltage, current, temperature", "Direct sensor or meter observation"],
      ["Calculated", "State of charge, state of health", "Model-derived estimate"],
      ["Commanded", "Requested contactor or cooling action", "Control intent"],
      ["Inferred", "Possible cause or condition", "Diagnostic hypothesis"]
    ]
  },
  "Battery evidence-to-next-check reasoning": {
    kind: "steps",
    steps: ["Preserve evidence", "Classify data", "Compare context", "Correlate systems", "Choose next check"]
  },
  "DC source, inverter, electric machine, and low-voltage support": {
    kind: "energy",
    lanes: [
      ["DC Energy Source", "Inverter", "Electric Machine"],
      ["DC Energy Source", "DC-DC Converter", "Low-Voltage System"]
    ]
  },
  "Commanded state to measured response": {
    kind: "steps",
    steps: ["Requested state", "Control action", "Measured response", "Compare", "Explain mismatch"]
  },
  "Power-electronics evidence categories": {
    kind: "table",
    headers: ["Evidence", "Question"],
    rows: [
      ["Supply", "Is required electrical input available?"],
      ["Command", "What operation was requested?"],
      ["Response", "What voltage, current, torque, or state occurred?"],
      ["Communication", "Are modules exchanging valid information?"],
      ["Thermal", "Is protection or derating active?"]
    ]
  },
  "Charge-readiness sequence": {
    kind: "steps",
    steps: ["Connection detected", "Supply recognized", "Interlocks satisfied", "Vehicle ready", "Energy transfer enabled"]
  },
  "Infrastructure-to-battery charging boundaries": {
    kind: "boundary",
    groups: [
      ["Infrastructure", "External source / equipment"],
      ["Interface", "Connector / communication"],
      ["Vehicle", "Control / conversion"],
      ["Battery", "Acceptance / protection"]
    ]
  },
  "Charging evidence by system boundary": {
    kind: "table",
    headers: ["Boundary", "Evidence examples"],
    rows: [
      ["Infrastructure", "Supply available, external equipment state"],
      ["Interface", "Connection recognition, communication state"],
      ["Vehicle", "Enable request, conversion status"],
      ["Battery", "Acceptance conditions, protection state"],
      ["Thermal", "Temperature-related limiting"]
    ]
  },
  "Cross-system thermal relationships": {
    kind: "nodes",
    nodes: ["Battery", "Power Electronics", "Electric Machine", "Cabin", "Ambient", "Thermal Control"],
    links: [["Battery","Thermal Control"],["Power Electronics","Thermal Control"],["Electric Machine","Thermal Control"],["Cabin","Thermal Control"],["Ambient","Thermal Control"]]
  },
  "Temperature, command, and performance trend": {
    kind: "timeline",
    points: [
      ["T1", "Normal temperature", "Normal command", "Full capability"],
      ["T2", "Rising temperature", "Cooling increases", "Capability maintained"],
      ["T3", "Limit approached", "Protection active", "Performance reduced"]
    ]
  },
  "Thermal evidence and alternative explanations": {
    kind: "table",
    headers: ["Observation", "Possible explanations"],
    rows: [
      ["High reported temperature", "Actual heat, sensor bias, poor heat transfer"],
      ["Cooling command high", "High load, restricted flow, actuator issue"],
      ["Reduced power", "Thermal protection, electrical limit, control strategy"]
    ]
  },
  "Low-voltage control dependency map": {
    kind: "nodes",
    nodes: ["Low-Voltage Supply", "Module Wake-Up", "Network Communication", "Contactor Control", "Propulsion Readiness"],
    links: [["Low-Voltage Supply","Module Wake-Up"],["Module Wake-Up","Network Communication"],["Network Communication","Contactor Control"],["Contactor Control","Propulsion Readiness"]]
  },
  "Wake-up, communication, and readiness sequence": {
    kind: "steps",
    steps: ["Low-voltage stable", "Modules wake", "Network online", "Preconditions checked", "Ready state requested"]
  },
  "Shared-dependency evidence matrix": {
    kind: "table",
    headers: ["Symptom cluster", "Shared dependency to investigate"],
    rows: [
      ["Several modules offline", "Power, ground, wake-up, network"],
      ["Many communication faults", "Shared supply or network condition"],
      ["No propulsion-ready state", "Foundational control prerequisites"]
    ]
  },
  "Request → Measure → Compare → Correlate → Verify": {
    kind: "steps",
    steps: ["Request", "Measure", "Compare", "Correlate", "Verify"]
  },
  "Competing hypotheses and discriminating evidence": {
    kind: "table",
    headers: ["Hypothesis", "Evidence that would support", "Discriminating check"],
    rows: [
      ["Supply dependency", "Multiple functions affected", "Verify shared supply state"],
      ["Control / communication", "Command missing or data unavailable", "Confirm command and network state"],
      ["Component condition", "Correct inputs but abnormal response", "Vehicle-specific functional test"]
    ]
  },
  "Evidence-supported repair and verification cycle": {
    kind: "cycle",
    steps: ["Concern", "Evidence", "Hypotheses", "Decision", "Action", "Verification"]
  }
};

function renderSvgNodes(model, title) {
  const positions = [
    [90,70],[260,45],[430,70],[120,190],[300,200],[470,185]
  ];
  const byName = new Map(model.nodes.map((name, index) => [name, positions[index] || [80 + (index % 3) * 180, 70 + Math.floor(index / 3) * 120]]));
  const lines = (model.links || []).map(([a,b]) => {
    const pa=byName.get(a), pb=byName.get(b);
    if(!pa || !pb) return "";
    return `<line x1="${pa[0]}" y1="${pa[1]}" x2="${pb[0]}" y2="${pb[1]}" class="viz-link" />`;
  }).join("");
  const nodes = model.nodes.map((name,index)=>{
    const [x,y]=byName.get(name);
    return `<g><rect x="${x-58}" y="${y-24}" width="116" height="48" rx="12" class="viz-node"/><text x="${x}" y="${y+4}" text-anchor="middle" class="viz-node-label">${escapeHtml(name)}</text></g>`;
  }).join("");
  return `<svg class="module-svg" viewBox="0 0 560 260" role="img" aria-label="${escapeHtml(title)}">${lines}${nodes}</svg>`;
}

function renderSvgSteps(model, title) {
  const count=model.steps.length;
  const gap=500/(count-1 || 1);
  return `<svg class="module-svg" viewBox="0 0 560 150" role="img" aria-label="${escapeHtml(title)}">
    ${model.steps.map((step,index)=>{
      const x=30+index*gap;
      const next=index<count-1 ? `<line x1="${x+42}" y1="75" x2="${x+gap-42}" y2="75" class="viz-link"/>` : "";
      return `${next}<circle cx="${x}" cy="75" r="28" class="viz-step"/><text x="${x}" y="80" text-anchor="middle" class="viz-step-number">${index+1}</text><text x="${x}" y="128" text-anchor="middle" class="viz-step-label">${escapeHtml(step)}</text>`;
    }).join("")}
  </svg>`;
}

function renderSvgEnergy(model, title) {
  return `<svg class="module-svg" viewBox="0 0 560 220" role="img" aria-label="${escapeHtml(title)}">
    ${model.lanes.map((lane,row)=>lane.map((label,index)=>{
      const x=80+index*200, y=65+row*95;
      const arrow=index<lane.length-1 ? `<line x1="${x+60}" y1="${y}" x2="${x+140}" y2="${y}" class="viz-link"/>` : "";
      return `${arrow}<rect x="${x-58}" y="${y-24}" width="116" height="48" rx="12" class="viz-node"/><text x="${x}" y="${y+4}" text-anchor="middle" class="viz-node-label">${escapeHtml(label)}</text>`;
    }).join("")).join("")}
  </svg>`;
}

function renderSvgBoundary(model, title) {
  return `<div class="boundary-visual" role="img" aria-label="${escapeHtml(title)}">
    ${model.groups.map((group,index)=>`<div><span>${String(index+1).padStart(2,"0")}</span><strong>${escapeHtml(group[0])}</strong><p>${escapeHtml(group[1])}</p></div>`).join("")}
  </div>`;
}

function renderSvgTimeline(model, title) {
  return `<div class="timeline-visual" role="img" aria-label="${escapeHtml(title)}">
    ${model.points.map((point)=>`<div><strong>${escapeHtml(point[0])}</strong><span>${escapeHtml(point[1])}</span><span>${escapeHtml(point[2])}</span><span>${escapeHtml(point[3])}</span></div>`).join("")}
  </div>`;
}

function renderSvgCycle(model, title) {
  return `<svg class="module-svg" viewBox="0 0 560 330" role="img" aria-label="${escapeHtml(title)}">
    ${model.steps.map((step,index)=>{
      const angle=(Math.PI*2*index/model.steps.length)-Math.PI/2;
      const x=280+170*Math.cos(angle), y=165+105*Math.sin(angle);
      return `<g><circle cx="${x}" cy="${y}" r="42" class="viz-cycle"/><text x="${x}" y="${y+4}" text-anchor="middle" class="viz-cycle-label">${escapeHtml(step)}</text></g>`;
    }).join("")}
    <circle cx="280" cy="165" r="48" class="viz-center"/><text x="280" y="160" text-anchor="middle" class="viz-center-label">Evidence</text><text x="280" y="180" text-anchor="middle" class="viz-center-label">loop</text>
  </svg>`;
}

function renderVisualTable(model, title) {
  return `<div class="module-data-table-wrap"><table class="module-data-table" aria-label="${escapeHtml(title)}"><thead><tr>${model.headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${model.rows.map(row=>`<tr>${row.map(cell=>`<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderOriginalModuleVisual(visual) {
  const model=AUT250_VISUAL_MODELS[visual.title];
  if(!model) return `<p class="visual-placeholder">Original AutoLearnPro instructional visual planned for this module.</p>`;
  if(model.kind==="nodes") return renderSvgNodes(model,visual.title);
  if(model.kind==="steps") return renderSvgSteps(model,visual.title);
  if(model.kind==="energy") return renderSvgEnergy(model,visual.title);
  if(model.kind==="boundary") return renderSvgBoundary(model,visual.title);
  if(model.kind==="timeline") return renderSvgTimeline(model,visual.title);
  if(model.kind==="cycle") return renderSvgCycle(model,visual.title);
  if(model.kind==="table") return renderVisualTable(model,visual.title);
  return `<p class="visual-placeholder">Original AutoLearnPro instructional visual planned for this module.</p>`;
}


function renderTrainingQuestions(questions = []) {
  if (!questions.length) return "";

  return `
    <div class="training-question-list">
      ${questions.map((question, index) => `
        <article class="training-question-card" data-training-question="${escapeHtml(question.id)}" data-answer="${escapeHtml(question.answer)}">
          <div class="training-question-head">
            <span>Training question ${String(index + 1).padStart(2, "0")}</span>
            <span class="training-question-status">${escapeHtml(titleCase(question.status))} · citation review pending</span>
          </div>
          <h6>${escapeHtml(question.stem)}</h6>
          <div class="training-question-options" role="radiogroup" aria-label="${escapeHtml(question.stem)}">
            ${Object.entries(question.choices || {}).map(([letter, label]) => `
              <label>
                <input type="radio" name="${escapeHtml(question.id)}" value="${escapeHtml(letter)}">
                <span><strong>${escapeHtml(letter)}.</strong> ${escapeHtml(label)}</span>
              </label>`).join("")}
          </div>
          <button type="button" class="training-check-answer" data-training-check="${escapeHtml(question.id)}">Check answer</button>
          <div class="training-feedback" data-training-feedback="${escapeHtml(question.id)}" aria-live="polite"></div>
          <p class="training-boundary">Training only · not scored · not eligible for high-stakes assessment · provenance and citation validation pending.</p>
        </article>`).join("")}
    </div>`;
}

function initTrainingQuestions() {
  const cards = [...document.querySelectorAll("[data-training-question]")];
  if (!cards.length) return;

  for (const card of cards) {
    const button = card.querySelector("[data-training-check]");
    const feedback = card.querySelector("[data-training-feedback]");
    if (!button || !feedback) continue;

    button.addEventListener("click", () => {
      const selected = card.querySelector('input[type="radio"]:checked');
      if (!selected) {
        feedback.textContent = "Select an answer before checking.";
        feedback.dataset.result = "incomplete";
        return;
      }

      const id = card.dataset.trainingQuestion;
      const module = card.closest("[data-course-module]");
      const question = module?._trainingQuestions?.find?.((item) => item.id === id);
      const isCorrect = selected.value === card.dataset.answer;

      feedback.dataset.result = isCorrect ? "correct" : "incorrect";
      feedback.innerHTML = `
        <strong>${isCorrect ? "Correct." : "Not yet."}</strong>
        ${question?.explanation ? `<span>${escapeHtml(question.explanation)}</span>` : ""}
      `;
    });
  }

  document.documentElement.dataset.aut250TrainingQuestions = "loaded";
}

function renderCourseModules(modules = []) {
  if (!modules.length) return "";

  return `
    <section class="course-module-experience" aria-labelledby="aut250-module-title">
      <div class="course-module-intro">
        <div>
          <p class="eyebrow">Learner course sequence</p>
          <h4 id="aut250-module-title">AUT-250 follow-on modules</h4>
          <p>Work through the six modules in sequence. Completion markers are stored only in this browser and do not represent scored assessment or institutional credit.</p>
        </div>
        <div class="module-progress" aria-live="polite">
          <strong><span data-module-complete-count>0</span> / ${modules.length}</strong>
          <span>modules completed</span>
        </div>
      </div>

      <nav class="module-jump-nav" aria-label="AUT-250 module navigation">
        ${modules.map((module) => `
          <a href="#${escapeHtml(module.id)}">
            <span>${String(module.sequence).padStart(2, "0")}</span>
            ${escapeHtml(module.title)}
          </a>`).join("")}
      </nav>

      <div class="course-module-list">
        ${modules.map((module) => `
          <article class="course-module-card" id="${escapeHtml(module.id)}" data-course-module="${escapeHtml(module.id)}">
            <header class="course-module-head">
              <div>
                <p class="module-kicker">Module ${String(module.sequence).padStart(2, "0")} · ${escapeHtml(String(module.estimatedMinutes))} MIN</p>
                <h5>${escapeHtml(module.title)}</h5>
              </div>
              <button type="button" class="module-complete-toggle" data-module-complete-toggle="${escapeHtml(module.id)}" aria-pressed="false">
                Mark complete
              </button>
            </header>

            <details open>
              <summary>Module objectives</summary>
              ${list(module.moduleObjectives || [], "module-objective-list")}
            </details>

            <details>
              <summary>Lessons</summary>
              <div class="module-lesson-list">
                ${(module.lessons || []).map((lesson, lessonIndex) => `
                  <article class="module-lesson">
                    <span>Lesson ${module.sequence}.${lessonIndex + 1}</span>
                    <h6>${escapeHtml(lesson.title)}</h6>
                    <p>${escapeHtml(lesson.text)}</p>
                    <p class="learner-action"><strong>Learner task:</strong> ${escapeHtml(lesson.learnerAction)}</p>
                    <p class="source-boundary"><strong>Evidence boundary:</strong> ${escapeHtml(lesson.evidenceBoundary)}</p>
                  </article>`).join("")}
              </div>
            </details>

            <details>
              <summary>Practice and assessment activities</summary>
              <div class="expanded-plan-overview module-activity-grid">
                <div><strong>Practice</strong>${list(module.practice || [])}</div>
                <div><strong>Assessment activities</strong>${list(module.assessments || [])}</div>
              </div>
            </details>

            <details>
              <summary>Planned visuals</summary>
              <div class="module-visual-grid">
                ${(module.visuals || []).map((visual) => `
                  <article>
                    <span>${escapeHtml(titleCase(visual.type))}</span>
                    <h6>${escapeHtml(visual.title)}</h6>
                    ${renderOriginalModuleVisual(visual)}
                  </article>`).join("")}
              </div>
            </details>

            <details class="training-question-section">
              <summary>Training questions (${(module.trainingQuestions || []).length})</summary>
              ${renderTrainingQuestions(module.trainingQuestions || [])}
            </details>

            <div class="module-safety-boundary">
              <strong>Safety and evidence boundary</strong>
              <p>${escapeHtml(module.safetyAndEvidenceBoundary)}</p>
            </div>
          </article>`).join("")}
      </div>
    </section>`;
}

function initModuleProgress() {
  const modules = [...document.querySelectorAll("[data-course-module]")];
  if (!modules.length) return;

  const storageKey = "autolearnpro:aut250:completed-modules";
  let completed = [];
  try {
    completed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(completed)) completed = [];
  } catch {
    completed = [];
  }

  const update = () => {
    const completedSet = new Set(completed);
    for (const module of modules) {
      const id = module.dataset.courseModule;
      const button = module.querySelector("[data-module-complete-toggle]");
      const isComplete = completedSet.has(id);
      module.dataset.completed = isComplete ? "true" : "false";
      if (button) {
        button.setAttribute("aria-pressed", String(isComplete));
        button.textContent = isComplete ? "Completed" : "Mark complete";
      }
    }

    document.querySelectorAll("[data-module-complete-count]")
      .forEach((node) => { node.textContent = String(completedSet.size); });

    try {
      localStorage.setItem(storageKey, JSON.stringify([...completedSet]));
    } catch {
      // Local progress is optional; the course remains usable without storage.
    }
  };

  document.querySelectorAll("[data-module-complete-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.moduleCompleteToggle;
      const set = new Set(completed);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      completed = [...set];
      update();
    });
  });

  update();
  document.documentElement.dataset.aut250Modules = "loaded";
}

function renderProgramMapping(mapping) {
  if (mapping.relationship === "course") {
    return `Program mapping: ${escapeHtml(mapping.programCourseId)} · ${escapeHtml(mapping.programCourseTitle)} · ${escapeHtml(titleCase(mapping.mappingType))}`;
  }

  return `Program mapping: ${escapeHtml(titleCase(mapping.classification))} · ${escapeHtml(mapping.title)}`;
}

function renderPlan(plan, lesson, course) {
  return `
    <article class="expanded-plan" id="${escapeHtml(plan.lessonPlanId)}">
      <div class="expanded-plan-head">
        <div>
          <p class="eyebrow">${escapeHtml(plan.programMapping?.programCourseTitle || course.title)} · ${escapeHtml(String(plan.estimatedMinutes))} MIN</p>
          <h3>${escapeHtml(lesson.title)}</h3>
          <p>${escapeHtml(plan.lessonSummary)}</p>
          <p class="program-context">${renderProgramMapping(plan.programMapping)}</p>
          ${plan.contentStatus ? `<div class="lesson-readiness"><span>${escapeHtml(titleCase(plan.contentStatus))}</span><span>${escapeHtml(titleCase(plan.evidenceApprovalStatus || "evidence status not recorded"))}</span></div>` : ""}
        </div>
        <span class="pathway-status${plan.status === "active" ? "" : " planned"}">${escapeHtml(plan.status.toUpperCase())}</span>
      </div>

      <div class="expanded-plan-overview">
        <div><strong>Prerequisites</strong>${list(plan.prerequisites)}</div>
        <div><strong>Key concepts</strong>${list(plan.keyConcepts)}</div>
      </div>

      <details open>
        <summary>Learning objectives</summary>
        <ol class="objective-list">${renderObjectives(plan.learningObjectives)}</ol>
      </details>

      <details>
        <summary>Instructional sequence</summary>
        <ol class="instruction-block-list">${renderBlocks(plan.contentBlocks)}</ol>
      </details>

      <details>
        <summary>Planned visuals</summary>
        <div class="lesson-visual-grid">${renderVisuals(plan.visuals)}</div>
      </details>

      <details>
        <summary>Practice and assessment</summary>
        <div class="expanded-plan-overview">
          <div><strong>Practice tasks</strong>${list(plan.practiceTasks)}</div>
          <div><strong>Assessment plan</strong>${list(plan.assessmentPlan)}</div>
        </div>
      </details>

      ${renderCourseModules(plan.courseModules)}

      <details>
        <summary>Evidence focus and boundaries</summary>
        <div class="evidence-boundary">
          <strong>Evidence focus</strong>
          ${list(plan.evidenceFocus)}
          <p><strong>Evidence expectation:</strong> ${escapeHtml(plan.evidenceExpectation)}</p>
          <p><strong>Assessment boundary:</strong> ${escapeHtml(plan.assessmentBoundary)}</p>
          ${plan.evidenceReview ? `
            <div class="lesson-review-state">
              <p><strong>Lesson content status:</strong> ${escapeHtml(titleCase(plan.contentStatus))}</p>
              <p><strong>Evidence approval:</strong> ${escapeHtml(titleCase(plan.evidenceApprovalStatus))}</p>
              <p><strong>Review note:</strong> ${escapeHtml(plan.evidenceReview.reviewNote)}</p>
              <p><strong>Pending technical-review chunks:</strong></p>
              ${list(plan.evidenceReview.pendingTechnicalReviewChunkIds || [], "pending-chunk-list")}
            </div>` : ""}
        </div>
      </details>
    </article>`;
}

function renderGroup(targetId, level, plans, lessons, courses) {
  const target = document.getElementById(targetId);
  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const html = plans
    .filter((plan) => lessonsById.get(plan.lessonPlanId)?.academicLevel === level)
    .map((plan) => {
      const lesson = lessonsById.get(plan.lessonPlanId);
      const course = coursesById.get(lesson.courseId);
      return renderPlan(plan, lesson, course);
    })
    .join("");
  target.innerHTML = html;
}
async function init() {
  try {
    const [contentDoc, lessonDoc, undergraduateDoc, graduateDoc] = await Promise.all([
      loadJson("lesson-content.json"),
      loadJson("lesson-plans.json"),
      loadJson("undergraduate-courses.json"),
      loadJson("graduate-courses.json")
    ]);

    const courses = [...undergraduateDoc.courses, ...graduateDoc.courses];
    renderGroup(
      "undergraduate-plan-list",
      "undergraduate",
      contentDoc.lessonContentPlans,
      lessonDoc.lessonPlans,
      courses
    );
    renderGroup(
      "graduate-plan-list",
      "graduate",
      contentDoc.lessonContentPlans,
      lessonDoc.lessonPlans,
      courses
    );

    document.querySelectorAll("[data-course-module]").forEach((node) => {
      const id = node.dataset.courseModule;
      node._trainingQuestions = contentDoc.lessonContentPlans
        .flatMap((plan) => plan.courseModules || [])
        .find((module) => module.id === id)?.trainingQuestions || [];
    });

    initModuleProgress();
    initTrainingQuestions();
    document.documentElement.dataset.lessonPlans = "loaded";
  } catch (error) {
    console.error(error);
    document.documentElement.dataset.lessonPlans = "error";
    for (const id of ["undergraduate-plan-list", "graduate-plan-list"]) {
      const target = document.getElementById(id);
      if (target) {
        target.innerHTML = '<div class="pathway-load-error">Expanded lesson plans are temporarily unavailable.</div>';
      }
    }
  }
}

init();
