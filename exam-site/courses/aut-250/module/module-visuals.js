const MODELS = {
  "Battery-system functional architecture": {
    kind:"architecture",
    primary:["Cells / Modules","Sensors","Control","Switching"],
    crossCutting:[
      ["Protection","Protection influences switching and system response"],
      ["Thermal","Thermal conditions influence control and protection"]
    ]
  },
  "Measured, calculated, commanded, and inferred battery data": {
    kind:"table",
    headers:["Evidence type","Examples","Meaning","Diagnostic caution"],
    rows:[
      ["Measured","Voltage, current, temperature","Observed data","Verify measurement quality and operating context"],
      ["Calculated","State of charge, state of health","Model-derived estimate","Depends on model assumptions and input data"],
      ["Commanded","Contactor or cooling request","Control intent","Shows requested behavior, not actual response"],
      ["Inferred","Possible condition","Diagnostic hypothesis","Treat as a hypothesis, not failure proof"]
    ]
  },
  "Battery evidence-to-next-check reasoning": { kind:"steps", items:["Preserve evidence","Classify data","Compare context","Correlate systems","Choose next check"] },

  "DC source, inverter, electric machine, and low-voltage support": { kind:"lanes", rows:[["DC energy source","Inverter","Electric machine"],["DC energy source","DC-DC converter","Low-voltage system"]] },
  "Commanded state to measured response": { kind:"steps", items:["Requested state","Control action","Measured response","Compare","Explain mismatch"] },
  "Power-electronics evidence categories": { kind:"table", headers:["Evidence","Question"], rows:[["Supply","Is required input available?"],["Command","What operation was requested?"],["Response","What response occurred?"],["Communication","Are modules exchanging valid information?"],["Thermal","Is protection or derating active?"]] },

  "Charge-readiness sequence": { kind:"steps", items:["Connection detected","Supply recognized","Interlocks satisfied","Vehicle ready","Energy transfer enabled"] },
  "Infrastructure-to-battery charging boundaries": { kind:"boundary", items:[["Infrastructure","External source / equipment"],["Interface","Connector / communication"],["Vehicle","Control / conversion"],["Battery","Acceptance / protection"]] },
  "Charging evidence by system boundary": { kind:"table", headers:["Boundary","Evidence examples"], rows:[["Infrastructure","Supply available, equipment state"],["Interface","Connection recognition, communication"],["Vehicle","Enable request, conversion status"],["Battery","Acceptance conditions, protection state"],["Thermal","Temperature-related limiting"]] },

  "Cross-system thermal relationships": { kind:"nodes", items:["Battery","Power electronics","Electric machine","Cabin","Ambient","Thermal control"] },
  "Temperature, command, and performance trend": { kind:"timeline", rows:[["T1","Normal temperature","Normal command","Full capability"],["T2","Rising temperature","Cooling increases","Capability maintained"],["T3","Limit approached","Protection active","Performance reduced"]] },
  "Thermal evidence and alternative explanations": { kind:"table", headers:["Observation","Possible explanations"], rows:[["High reported temperature","Actual heat, sensor bias, poor heat transfer"],["Cooling command high","High load, restricted flow, actuator issue"],["Reduced power","Thermal protection, electrical limit, control strategy"]] },

  "Low-voltage control dependency map": { kind:"steps", items:["Low-voltage supply","Module wake-up","Network communication","Contactor control","Propulsion readiness"] },
  "Wake-up, communication, and readiness sequence": { kind:"steps", items:["Low-voltage stable","Modules wake","Network online","Preconditions checked","Ready state requested"] },
  "Shared-dependency evidence matrix": { kind:"table", headers:["Symptom cluster","Shared dependency to investigate"], rows:[["Several modules offline","Power, ground, wake-up, network"],["Many communication faults","Shared supply or network condition"],["No propulsion-ready state","Foundational control prerequisites"]] },

  "Request → Measure → Compare → Correlate → Verify": { kind:"steps", items:["Request","Measure","Compare","Correlate","Verify"] },
  "Competing hypotheses and discriminating evidence": { kind:"table", headers:["Hypothesis","Evidence that would support","Discriminating check"], rows:[["Supply dependency","Multiple functions affected","Verify shared supply state"],["Control / communication","Command missing or data unavailable","Confirm command and network state"],["Component condition","Correct inputs but abnormal response","Vehicle-specific functional test"]] },
  "Evidence-supported repair and verification cycle": { kind:"cycle", items:["Concern","Evidence","Hypotheses","Decision","Action","Verification"] }
};

const TAKEAWAYS = {
  "Battery-system functional architecture": "Battery evidence becomes more useful when sensing, protection, switching, control, and thermal functions are considered as one interacting system.",
  "Measured, calculated, commanded, and inferred battery data": "A direct measurement, a model-derived state, a control request, and a diagnostic hypothesis are different evidence types.",
  "Battery evidence-to-next-check reasoning": "Preserve and classify evidence before choosing the next diagnostic check.",
  "DC source, inverter, electric machine, and low-voltage support": "Energy conversion and low-voltage support are related functions, so symptoms should be interpreted across system boundaries.",
  "Commanded state to measured response": "Comparing control intent with measured response can reveal where behavior diverges without prematurely naming a failed component.",
  "Power-electronics evidence categories": "Supply, command, response, communication, and thermal evidence should be correlated before drawing a conclusion.",
  "Charge-readiness sequence": "A charging concern can be narrowed by identifying the first readiness condition that does not occur as expected.",
  "Infrastructure-to-battery charging boundaries": "Charging diagnosis is clearer when infrastructure, interface, vehicle, and battery evidence are kept distinct.",
  "Charging evidence by system boundary": "Evidence should be assigned to the system boundary that produced it before causes are inferred.",
  "Cross-system thermal relationships": "Thermal behavior can involve several vehicle systems at once, so temperature data needs operating context.",
  "Temperature, command, and performance trend": "A temperature value becomes more informative when viewed as a trend alongside command and performance changes.",
  "Thermal evidence and alternative explanations": "The same thermal symptom may support several explanations, so discriminating evidence is needed.",
  "Low-voltage control dependency map": "Low-voltage stability can affect wake-up, communication, switching control, and propulsion readiness.",
  "Wake-up, communication, and readiness sequence": "Foundational readiness conditions should be confirmed before higher-level propulsion conclusions are made.",
  "Shared-dependency evidence matrix": "Multiple simultaneous symptoms can point toward a shared dependency rather than several independent failures.",
  "Request → Measure → Compare → Correlate → Verify": "Use the complete reasoning sequence so evidence is collected, interpreted, related, and confirmed before closure.",
  "Competing hypotheses and discriminating evidence": "Keep more than one plausible explanation until evidence meaningfully separates them.",
  "Evidence-supported repair and verification cycle": "A diagnostic decision is incomplete until the outcome is verified under relevant conditions."
};

function esc(value) {
  return String(value ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

function steps(model) {
  return `<ol class="module-visual-steps">${model.items.map((item,index)=>`
    <li data-visual-reasoning-step="${esc(slug(item))}">
      <span>${String(index+1).padStart(2,"0")}</span><strong>${esc(item)}</strong>
      ${index < model.items.length - 1 ? '<b class="module-visual-step-arrow" aria-hidden="true">→</b>' : ""}
    </li>`).join("")}</ol>`;
}

function nodes(model) {
  return `<div class="module-visual-node-map" role="img" aria-label="Functional relationship diagram">${model.items.map((item,index)=>`<div class="module-visual-node"><span>${String(index+1).padStart(2,"0")}</span><strong>${esc(item)}</strong></div>`).join("")}</div>`;
}

function architecture(model) {
  return `
    <div class="module-visual-architecture" role="img" aria-label="Battery functional architecture showing primary flow and cross-cutting influences">
      <div class="module-architecture-primary">
        ${model.primary.map((item,index)=>`
          <div class="module-architecture-step">
            <strong>${esc(item)}</strong>
            ${index < model.primary.length - 1 ? '<span class="module-architecture-arrow" aria-hidden="true">→</span>' : ""}
          </div>`).join("")}
      </div>
      <div class="module-architecture-cross">
        ${model.crossCutting.map(([name,description])=>`
          <article><strong>${esc(name)}</strong><span aria-hidden="true">↗</span><small>${esc(description)}</small></article>`).join("")}
      </div>
    </div>`;
}

function lanes(model) {
  return `<div class="module-visual-lanes">${model.rows.map((row)=>`<div class="module-visual-lane">${row.map((item,index)=>`<span>${esc(item)}${index<row.length-1?'<b aria-hidden="true">→</b>':""}</span>`).join("")}</div>`).join("")}</div>`;
}

function table(model, title) {
  return `<div class="module-visual-table-wrap"><table class="module-visual-table" aria-label="${esc(title)}"><thead><tr>${model.headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${model.rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function boundary(model) {
  return `<div class="module-visual-boundaries">${model.items.map(([name,desc],index)=>`<div><span>${String(index+1).padStart(2,"0")}</span><strong>${esc(name)}</strong><small>${esc(desc)}</small></div>`).join("")}</div>`;
}

function timeline(model) {
  return `<div class="module-visual-timeline">${model.rows.map(row=>`<div><strong>${esc(row[0])}</strong><span>${esc(row[1])}</span><span>${esc(row[2])}</span><span>${esc(row[3])}</span></div>`).join("")}</div>`;
}

function cycle(model) {
  return `<div class="module-visual-cycle" role="img" aria-label="Evidence-supported repair and verification cycle">${model.items.map((item,index)=>`<span style="--cycle-index:${index}">${esc(item)}</span>`).join("")}<strong>Evidence loop</strong></div>`;
}

function renderModel(model, title) {
  if (!model) return '<p class="module-visual-missing">Visual model unavailable.</p>';
  if (model.kind === "steps") return steps(model);
  if (model.kind === "nodes") return nodes(model);
  if (model.kind === "architecture") return architecture(model);
  if (model.kind === "lanes") return lanes(model);
  if (model.kind === "table") return table(model,title);
  if (model.kind === "boundary") return boundary(model);
  if (model.kind === "timeline") return timeline(model);
  if (model.kind === "cycle") return cycle(model);
  return '<p class="module-visual-missing">Visual model unavailable.</p>';
}

export function renderModuleVisuals(visuals = []) {
  return visuals.map((visual)=> {
    const model = MODELS[visual.title];
    return `<article class="module-visual-card" data-module-visual="${esc(visual.title)}">
      <div class="module-visual-card-head"><span>${esc(String(visual.type || "visual").replace(/-/g," "))}</span><strong>${esc(visual.title)}</strong></div>
      ${renderModel(model,visual.title)}
      <p class="module-visual-takeaway"><strong>Takeaway:</strong> ${esc(TAKEAWAYS[visual.title] || "Use this visual to organize evidence before drawing a diagnostic conclusion.")}</p>
    </article>`;
  }).join("");
}

export const AUT250_VISUAL_TITLES = Object.freeze(Object.keys(MODELS));


export function setModuleVisualReasoningStep(step) {
  document.querySelectorAll("[data-visual-reasoning-step]").forEach((item) => {
    const active = item.dataset.visualReasoningStep === step;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
}
