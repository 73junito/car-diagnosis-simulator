const MODELS = {
  "Battery-system functional architecture": { kind:"nodes", items:["Cells / Modules","Sensors","Protection","Control","Switching","Thermal"] },
  "Measured, calculated, commanded, and inferred battery data": { kind:"table", headers:["Evidence type","Examples","Meaning"], rows:[["Measured","Voltage, current, temperature","Observed data"],["Calculated","State of charge, state of health","Model-derived estimate"],["Commanded","Contactor or cooling request","Control intent"],["Inferred","Possible condition","Diagnostic hypothesis"]] },
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

function esc(value) {
  return String(value ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function steps(model) {
  return `<ol class="module-visual-steps">${model.items.map((item,index)=>`<li><span>${String(index+1).padStart(2,"0")}</span><strong>${esc(item)}</strong></li>`).join("")}</ol>`;
}

function nodes(model) {
  return `<div class="module-visual-node-map" role="img" aria-label="Functional relationship diagram">${model.items.map((item,index)=>`<div class="module-visual-node"><span>${String(index+1).padStart(2,"0")}</span><strong>${esc(item)}</strong></div>`).join("")}</div>`;
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
    </article>`;
  }).join("");
}

export const AUT250_VISUAL_TITLES = Object.freeze(Object.keys(MODELS));
