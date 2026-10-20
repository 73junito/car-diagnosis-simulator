/**
 * Independent ngspice runner for Gate 2C-V.
 *
 * Executes the hand-authored SPICE decks with the ngspice console executable in
 * batch mode and parses its printed operating point. The runner never generates
 * an expected value: it only reports what the external simulator produced.
 *
 * If ngspice is not available the caller must skip the comparison rather than
 * substitute an internally generated expectation.
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/** Candidate locations, most specific first. */
const CANDIDATE_PATHS = [
  process.env.TORQUEMIND_NGSPICE_CONSOLE,
  path.join(
    os.homedir(),
    'AppData',
    'Local',
    'Programs',
    'ngspice-47',
    'Spice64',
    'bin',
    'ngspice_con.exe'
  ),
  'C:/Spice64/bin/ngspice_con.exe',
  'C:/Program Files/ngspice/bin/ngspice_con.exe',
  '/usr/bin/ngspice',
  '/usr/local/bin/ngspice'
].filter((candidate) => typeof candidate === 'string' && candidate.length > 0);

function findNgspice() {
  for (const candidate of CANDIDATE_PATHS) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore unreadable candidates */
    }
  }
  return null;
}

/** Runs a deck and returns its raw stdout plus the exit code. */
function runDeck(executable, deckPath) {
  const output = execFileSync(executable, ['-b', deckPath], {
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return output;
}

/**
 * Parses `name = value` operating-point lines.
 * Returns a lowercase-keyed map, for example `v(20)`, `i(vsrc)`, `@rfuse[i]`.
 */
function parseOperatingPoint(output) {
  const values = {};
  const errors = [];
  for (const line of String(output).split(/\r?\n/)) {
    const match = /^\s*([A-Za-z0-9_@().[\]]+)\s*=\s*(-?[\d.]+(?:e[+-]?\d+)?)\s*$/i.exec(line);
    if (match) {
      values[match[1].toLowerCase()] = Number(match[2]);
      continue;
    }
    if (/^\s*Error:/i.test(line)) errors.push(line.trim());
  }
  return { values, errors };
}

/** Reports the ngspice version banner, for evidence. */
function ngspiceVersion(executable) {
  const output = execFileSync(executable, ['-v'], { encoding: 'utf8', timeout: 30000 });
  const match = /ngspice-([\d.]+)/.exec(output);
  return match ? `ngspice-${match[1]}` : 'ngspice-unknown';
}

module.exports = { findNgspice, runDeck, parseOperatingPoint, ngspiceVersion, CANDIDATE_PATHS };
