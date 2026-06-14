const graph = {
  overheating: {
    causes: ['coolant_leak', 'thermostat_failure', 'radiator_blockage']
  },
  misfire: {
    causes: ['spark_plug_fault', 'fuel_injector_issue', 'ignition_coil_failure']
  },
  'battery-drain': {
    causes: ['parasitic_draw', 'faulty_alternator', 'old_battery']
  },
  'brake-noise': {
    causes: ['worn_pads', 'rotor_warp', 'foreign_object']
  }
};

function getGraph() {
  return graph;
}

function getCauses(symptom) {
  return graph[symptom] && Array.isArray(graph[symptom].causes) ? graph[symptom].causes.slice() : [];
}

module.exports = {
  getGraph,
  getCauses
};
