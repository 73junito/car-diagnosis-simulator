// Canonical mapping from routed scenario keys to independent question banks.
// Keep variants separate so each individual URL can mature to its own 20-question bank.
window.SCENARIO_CONTENT_MAP = Object.freeze({
  'no-crank-clicking': 'no-crank',
  'no-start': 'no-start',
  'overheating': 'overheating',
  'electrical-load': 'electrical-load',
  'misfire-acceleration': 'misfire',
  'steering-alignment': 'steering-alignment',
  'hvac-cooling': 'hvac-cooling',
  'stalling': 'stalling',
  'misfire-p0300': 'misfire-9',
  'power-loss': 'power-loss',
  'no-crank-starter-click': 'no-crank-11',
  'intermittent-starting': 'intermittent-starting',
  'charging-system': 'charging-system',
  'can-bus-network': 'can-bus-network',
  'hybrid-ev-isolation': 'hybrid-ev',
  'diesel-aftertreatment': 'diesel-aftertreatment',
  'hybrid-ev-insulation': 'hybrid-ev-17',
  'automatic-transmission-delayed-drive': 'automatic-transmission',
  'manual-transmission-no-drive': 'manual-transmission',
  'differential-speed-whine': 'differential',
  'transaxle-fluid-leak-shift-hesitation': 'transaxle'
});
