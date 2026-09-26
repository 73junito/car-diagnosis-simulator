"use strict";

/** @typedef {"battery"|"alternator"|"regulator"|"fusible_link"|"fuse"|"relay"|"switch"|"motor"|"lamp"|"resistor"|"sensor"|"actuator"|"module"|"connector"|"splice"|"junction"|"ground"|"load"|"test_point"|"bus"} CircuitComponentType */
/** @typedef {"hardwire"|"power_feed"|"ground_reference"|"control"|"CAN"|"LIN"|"PWM"|"analog_signal"|"digital_signal"} ConnectionType */
/** @typedef {"open_circuit"|"high_resistance"|"short_to_ground"|"short_to_power"} CircuitFaultType */

const COMPONENT_TYPES = Object.freeze([
  "battery", "alternator", "regulator", "fusible_link", "fuse", "relay",
  "switch", "motor", "lamp", "resistor", "sensor", "actuator", "module",
  "connector", "splice", "junction", "ground", "load", "test_point", "bus"
]);
const CONNECTION_TYPES = Object.freeze([
  "hardwire", "power_feed", "ground_reference", "control", "CAN", "LIN",
  "PWM", "analog_signal", "digital_signal"
]);
const FAULT_TYPES = Object.freeze([
  "open_circuit", "high_resistance", "short_to_ground", "short_to_power"
]);

const api = { COMPONENT_TYPES, CONNECTION_TYPES, FAULT_TYPES };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindCircuitContracts = api;
