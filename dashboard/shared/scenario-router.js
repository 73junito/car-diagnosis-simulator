(function () {
  function normalizeScenarioId(value) {
    return String(value || "").toLowerCase().trim();
  }

  function findScenarioById(id) {
    const target = normalizeScenarioId(id);
    if (!target) return null;

    const registryMatch = (window.SCENARIO_REGISTRY || []).find((scenario) =>
      normalizeScenarioId(scenario.id) === target ||
      normalizeScenarioId(scenario.numericId) === target
    );

    if (registryMatch) return registryMatch.raw || registryMatch;

    return (window.scenarios || []).find((scenario) =>
      normalizeScenarioId(scenario.id) === target ||
      normalizeScenarioId(scenario.slug) === target ||
      normalizeScenarioId(scenario.symptomCategory) === target ||
      normalizeScenarioId(scenario.symptoms) === target
    ) || null;
  }

  function scenarioUrl(id) {
    return "/dashboard/student/scenario/?id=" + encodeURIComponent(id || "");
  }

  window.TorqueMindScenarioRouter = {
    findScenarioById,
    normalizeScenarioId,
    scenarioUrl
  };
})();
