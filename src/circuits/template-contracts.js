(function () {
"use strict";

function validateCircuitTemplate(template, engine, symbolRegistry, connectionRegistry) {
  const errors = [];
  if (!template || typeof template !== "object") return { valid:false, errors:["template must be an object"] };
  if (!template.templateId) errors.push("templateId is required");
  if (!template.templateVersion) errors.push("templateVersion is required");
  if (template.templateRole !== "reusable-training-circuit-template") errors.push("templateRole must be reusable-training-circuit-template");
  if (!template.systemKind) errors.push("systemKind is required");

  const circuitValidation = engine.validateCircuit(template);
  errors.push(...circuitValidation.errors);

  for (const component of template.components || []) {
    if (!component.symbolId) errors.push(`component ${component.id} requires symbolId`);
    const symbol = component.symbolId && symbolRegistry?.get(component.symbolId);
    if (!symbol) {
      errors.push(`component ${component.id} references unknown symbolId ${component.symbolId}`);
      continue;
    }
    for (const terminal of component.terminals || []) {
      if (!terminal.symbolTerminalId) {
        errors.push(`terminal ${terminal.id} requires symbolTerminalId`);
      } else if (!symbol.terminals.some((candidate) => candidate.id === terminal.symbolTerminalId)) {
        errors.push(`terminal ${terminal.id} references unknown symbol terminal ${terminal.symbolTerminalId}`);
      }
    }
  }

  for (const connection of template.connections || []) {
    if (!connectionRegistry?.get(connection.styleId)) errors.push(`connection ${connection.id} references unknown styleId ${connection.styleId}`);
  }

  if (!Array.isArray(template.operatingStates) || template.operatingStates.length === 0) {
    errors.push("operatingStates must contain at least one state");
  }

  return { valid: errors.length === 0, errors };
}

const api = { validateCircuitTemplate };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindCircuitTemplateContracts = api;
})();
