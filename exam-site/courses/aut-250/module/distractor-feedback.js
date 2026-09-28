export const DISTRACTOR_FEEDBACK = {
  "aut250-m1-q01": {
    A: "The word “always” overstates the relationship. Calculated states and direct measurements are different evidence types, and neither is universally more accurate in every context.",
    C: "Direct measurements are usable diagnostic evidence; the key distinction is how they differ from model-derived states.",
    D: "Calculated states can change as their inputs and operating conditions change, so this absolute statement is too broad."
  },
  "aut250-m1-q02": {
    A: "One unusual point is not enough evidence to justify replacement; the module emphasizes correlation across compatible evidence.",
    B: "A stored code is evidence to investigate, not automatic proof of the failed component.",
    D: "Calculated values can still contribute useful evidence when they are interpreted with their inputs and operating context."
  },
  "aut250-m1-q03": {
    B: "State of charge is treated here as a model-derived estimate rather than a direct physical measurement of stored energy.",
    C: "A state-of-charge estimate does not by itself establish overall battery health.",
    D: "AUT-250 does not use universal replacement thresholds; vehicle-specific criteria must come from applicable authoritative information."
  },
  "aut250-m1-q04": {
    A: "Battery access and isolation are vehicle-specific, so a universal disconnect sequence is not an acceptable general rule.",
    C: "Cable color alone is not sufficient verification of electrical state or safe access.",
    D: "Switching the ignition off does not replace the applicable isolation and verification procedure."
  },
  "aut250-m2-q01": {
    B: "A mismatch between command and response can identify a divergence, but it does not by itself prove an inverter failure.",
    C: "Applicable service information is still needed to interpret expected behavior and vehicle-specific criteria.",
    D: "AUT-250 does not establish universal pass/fail current values."
  },
  "aut250-m2-q02": {
    A: "Diagnostic codes can be useful evidence; the limitation is treating one code as automatic component-failure proof.",
    C: "The issue is not whether a converter can fail, but whether the available evidence actually establishes that failure.",
    D: "The reasoning boundary is broader than a single voltage domain; the code must be interpreted in the relevant system context."
  },
  "aut250-m2-q03": {
    B: "Regenerative operation is not defined as electrical energy being converted only to heat.",
    C: "The low-voltage battery is part of vehicle support functions, not the direct traction-energy relationship described by this question.",
    D: "The module does not support a universal claim that the inverter is bypassed in every vehicle."
  },
  "aut250-m2-q04": {
    B: "A universal nominal voltage cannot substitute for identifying the actual vehicle architecture and voltage domains.",
    C: "A fixed switching frequency is not a general starting point for interpreting every inverter or converter system.",
    D: "A generic internal diagram may not represent the actual vehicle topology or control strategy."
  },
  "aut250-m3-q01": {
    A: "A no-charge condition can involve several system boundaries, so treating all charging concerns as battery failures is too narrow.",
    C: "Replacing the charge port before locating the failed readiness or energy-transfer boundary is premature.",
    D: "One unsuccessful attempt does not identify where the charging sequence stopped."
  },
  "aut250-m3-q02": {
    B: "Charging systems can provide diagnostic evidence; the concern is interpreting that evidence across multiple prerequisites and boundaries.",
    C: "External equipment is one of the system boundaries that may affect charging and cannot be excluded categorically.",
    D: "Battery acceptance and battery-related conditions can be part of the charging sequence."
  },
  "aut250-m3-q03": {
    B: "Opening the battery pack is an intrusive action and is not an appropriate first reasoning step for a general no-charge concern.",
    C: "Assuming the external equipment is defective skips evidence collection and boundary isolation.",
    D: "AUT-250 does not apply a universal handshake voltage across different vehicle architectures."
  },
  "aut250-m4-q01": {
    A: "A temperature value without sensor plausibility, operating state, trend, and context is incomplete evidence.",
    C: "An unusual temperature is evidence to investigate, not automatic proof that the component has failed.",
    D: "Thermal behavior can be related to propulsion performance and protection behavior."
  },
  "aut250-m4-q02": {
    A: "A reduced-power event with rising temperature can have several explanations and does not automatically prove battery failure.",
    C: "The observation does not by itself isolate the cooling pump as the cause.",
    D: "Operating conditions are part of the context needed to interpret thermal limiting."
  },
  "aut250-m4-q03": {
    B: "Temperature remains important diagnostic evidence; the issue is using universal numeric limits across different designs.",
    C: "Electrified vehicles can use different cooling architectures and strategies.",
    D: "Whether a thermal system is serviceable does not establish a universal threshold for diagnosis."
  },
  "aut250-m5-q01": {
    B: "The low-voltage system can support readiness and control functions, but this is different from directly powering the traction motor.",
    C: "High-voltage propulsion systems still depend on control modules and communication functions.",
    D: "Low-voltage instability can affect module communication and wake-up behavior."
  },
  "aut250-m5-q02": {
    B: "Simultaneous module loss can indicate a shared dependency, so assuming multiple independent failures is premature.",
    C: "Battery state of charge alone does not account for the shared power, ground, wake-up, network, or timing possibilities described here.",
    D: "The highest-numbered code is not automatically the root cause or the best starting point."
  },
  "aut250-m5-q03": {
    B: "A readiness-first strategy includes foundational low-voltage checks rather than skipping them.",
    C: "Readiness evidence does not by itself prove that a high-voltage system is de-energized.",
    D: "The purpose is evidence collection and risk-aware escalation, not faster module replacement."
  },
  "aut250-m6-q01": {
    B: "Repair prices are not the comparison step in this diagnostic reasoning model.",
    C: "Comparing only two codes is too narrow; the step concerns observed behavior versus applicable information and expected context.",
    D: "The model does not assume the requested state is correct; it uses evidence to evaluate the concern."
  },
  "aut250-m6-q02": {
    B: "Competing hypotheses are used to guide evidence collection, not to avoid collecting evidence.",
    C: "The goal is to distinguish explanations before acting, not to perform every possible repair.",
    D: "Selecting the first component mentioned by a code encourages confirmation bias instead of testing alternatives."
  },
  "aut250-m6-q03": {
    B: "Post-repair verification cannot guarantee that no future fault will ever occur.",
    C: "Verification strengthens documentation rather than eliminating the need for it.",
    D: "Resolving the original concern does not require proving that every related component is new."
  }
};

export function getDistractorFeedback(questionId, answerKey) {
  const entry = DISTRACTOR_FEEDBACK[questionId] || {};
  return Object.fromEntries(
    Object.entries(entry).filter(([letter]) => letter !== answerKey)
  );
}
