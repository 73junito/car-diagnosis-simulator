/**
 * @jest-environment node
 */

'use strict';

/**
 * Solver bundle reproducibility, credential scanning and performance budgets.
 *
 * The bundle is built into a temporary directory so these tests never depend on
 * a pre-existing artifact and never leave build output behind.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const build = require('../scripts/build-simulation');
const simulation = require('../src/simulation');

const root = path.resolve(__dirname, '..');
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));

const template = readJson('data/circuit-templates/12v-starting-system-v2.json');
const MODEL_REF = 'data/circuit-templates/12v-starting-system-v2.json';

describe('solver bundle', () => {
  let firstBuild;
  let secondBuild;

  beforeAll(() => {
    const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'gate2c-a-'));
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'gate2c-b-'));
    firstBuild = build.buildTo(dirA);
    secondBuild = build.buildTo(dirB);
  });

  test('is byte-identical across repeated builds', () => {
    expect(build.sha256(secondBuild)).toBe(build.sha256(firstBuild));
  });

  test('contains no server credentials or environment access', () => {
    const source = fs.readFileSync(firstBuild, 'utf8');
    for (const pattern of build.FORBIDDEN_PATTERNS) {
      expect({ pattern, present: source.includes(pattern) }).toEqual({ pattern, present: false });
    }
  });

  test('is a self-contained bundle with no dynamic imports', () => {
    const source = fs.readFileSync(firstBuild, 'utf8');
    expect(source).not.toMatch(/\bimport\s*\(/);
    expect(source).not.toMatch(/\brequire\s*\(\s*['"]/);
    expect(source.length).toBeGreaterThan(1000);
  });

  test('stays within the proposed transfer budget', () => {
    const raw = fs.readFileSync(firstBuild);
    const gzipped = zlib.gzipSync(raw);
    // Proposed budget from the Gate 1 architecture proposal: 120 KB gzipped.
    expect(gzipped.length).toBeLessThanOrEqual(120 * 1024);
  });
});

describe('solver performance against the proposed budgets', () => {
  function pilotSolve() {
    const translated = simulation.translateTemplate(template, {
      modelRef: MODEL_REF,
      operatingStateId: 'crank',
      removedElementIds: []
    });
    if (!translated.ok) throw new Error('translation failed');
    return simulation.solveMna(translated.netlist);
  }

  test('translates and solves the pilot network within the interaction budget', () => {
    const samples = [];
    for (let index = 0; index < 200; index += 1) {
      const start = process.hrtime.bigint();
      const solved = pilotSolve();
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      expect(solved.ok).toBe(true);
      samples.push(elapsedMs);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length * 0.5)];
    const p95 = samples[Math.floor(samples.length * 0.95)];
    const worst = samples[samples.length - 1];

    // Proposed budgets: solve <= 50 ms p95 with a 500 ms hard ceiling.
    expect(p95).toBeLessThanOrEqual(50);
    expect(worst).toBeLessThanOrEqual(500);

    // Recorded as evidence rather than asserted, since machine speed varies.

    console.log(
      `[perf] pilot translate+solve p50=${p50.toFixed(3)} ms p95=${p95.toFixed(3)} ms max=${worst.toFixed(3)} ms`
    );
  });

  test('reports the node and unknown counts of the pilot network', () => {
    const translated = simulation.translateTemplate(template, {
      modelRef: MODEL_REF,
      operatingStateId: 'crank',
      removedElementIds: []
    });
    expect(translated.ok).toBe(true);
    const solved = simulation.solveMna(translated.netlist);
    expect(solved.ok).toBe(true);

    console.log(
      `[perf] pilot network nodes=${translated.netlist.nodes.length} elements=${translated.netlist.elements.length} unknowns=${solved.unknownCount}`
    );
    expect(solved.unknownCount).toBeLessThanOrEqual(40);
  });
});
