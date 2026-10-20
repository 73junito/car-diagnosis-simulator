'use strict';

/**
 * Gate 2B contract validation.
 *
 * These tests validate the shared multi-domain contracts, the versioned JSON
 * schemas, the laboratory-to-domain coverage plan, and the Starting-System
 * template v2.0.0 engineering additions.
 *
 * They deliberately assert nothing about numerical results: no numerical engine
 * exists in Gate 2B, and a passing contract test is not evidence of solver
 * correctness.
 */

const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');

const root = path.resolve(__dirname, '..');
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));

const DOMAIN_IDS = [
  'electrical',
  'mechanical',
  'hydraulic',
  'thermal',
  'powertrain',
  'network-control',
  'vehicle-dynamics',
  'integrated-diagnostics'
];

const FORBIDDEN_AUTHORITY_KEYS = [
  'correctAnswer',
  'score',
  'points',
  'assessmentEligible',
  'publicationApproved',
  'diagnosticConclusion'
];

/** Interface and type names the Gate 2B directive requires to exist. */
const REQUIRED_CONTRACT_NAMES = [
  'VehicleConfiguration',
  'SimulationEngine',
  'DomainAdapter',
  'ModelManifest',
  'ModelState',
  'FaultScenario',
  'MeasurementRequest',
  'SimulationResult',
  'ObservedMeasurement',
  'EvidenceRecord',
  'DiagnosticHypothesis',
  'VerificationPlan',
  'OperatingMode',
  'ModeReuseContract',
  'EngineCapability',
  'DomainRegistry',
  'InterDomainCoupling',
  'StudentReasoningRecord',
  'PredictionComparison',
  'Quantity',
  'FailureDetail'
];

function collectKeys(node, out = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectKeys(item, out));
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  for (const [key, value] of Object.entries(node)) {
    out.push(key);
    collectKeys(value, out);
  }
  return out;
}

describe('Gate 2B shared multi-domain contracts', () => {
  describe('versioned JSON schemas', () => {
    const schemaFiles = [
      'schemas/model-manifest.schema.json',
      'schemas/lab-domain-coverage.schema.json',
      'schemas/circuit-template-v2.schema.json'
    ];

    test('every declared schema compiles under strict draft 2020-12', () => {
      const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
      for (const file of schemaFiles) {
        const schema = readJson(file);
        expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
        expect(typeof schema.$id).toBe('string');
        expect(() => ajv.compile(schema)).not.toThrow();
      }
    });

    test('the coverage plan validates against its schema', () => {
      const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
      const validate = ajv.compile(readJson('schemas/lab-domain-coverage.schema.json'));
      const coverage = readJson('data/architecture/lab-domain-coverage.json');
      const valid = validate(coverage);
      if (!valid) throw new Error(JSON.stringify(validate.errors, null, 2));
      expect(valid).toBe(true);
    });

    test('the Starting-System v2 template validates against the v2 schema', () => {
      const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
      const validate = ajv.compile(readJson('schemas/circuit-template-v2.schema.json'));
      const template = readJson('data/circuit-templates/12v-starting-system-v2.json');
      const valid = validate(template);
      if (!valid) throw new Error(JSON.stringify(validate.errors, null, 2));
      expect(valid).toBe(true);
    });
  });

  describe('laboratory-to-domain coverage plan', () => {
    const coverage = readJson('data/architecture/lab-domain-coverage.json');
    const registry = readJson('data/lmf/lab-registry.json');

    test('points at the canonical LMF registry and introduces no competing registry', () => {
      expect(coverage.canonicalRegistry).toBe('data/lmf/lab-registry.json');
      expect(coverage.registryRole).toBe('lab-to-domain-coverage-plan');
      expect(coverage.notice).toMatch(/not evidence/i);
    });

    test('covers all 17 canonical labs exactly once', () => {
      expect(registry.labs).toHaveLength(17);
      expect(coverage.labs).toHaveLength(17);
      const canonicalIds = registry.labs.map((lab) => lab.labId).sort();
      const coveredIds = coverage.labs.map((lab) => lab.labId).sort();
      expect(coveredIds).toEqual(canonicalIds);
    });

    test('lifecycle state agrees with the canonical registry', () => {
      const lifecycleById = new Map(registry.labs.map((lab) => [lab.labId, lab.lifecycle]));
      for (const lab of coverage.labs) {
        expect(lab.lifecycle).toBe(lifecycleById.get(lab.labId));
      }
      expect(coverage.labs.filter((lab) => lab.lifecycle === 'existing')).toHaveLength(7);
      expect(coverage.labs.filter((lab) => lab.lifecycle === 'planned')).toHaveLength(10);
    });

    test('declares the eight coordinated domains and references no unknown domain', () => {
      expect([...coverage.domainIds].sort()).toEqual([...DOMAIN_IDS].sort());
      for (const lab of coverage.labs) {
        expect(DOMAIN_IDS).toContain(lab.primaryDomainId);
        for (const domainId of lab.coupledDomainIds) expect(DOMAIN_IDS).toContain(domainId);
        expect(lab.declaredDomainLabels.length).toBeGreaterThan(0);
      }
    });

    test('does not claim any engine is validated in Gate 2B', () => {
      for (const lab of coverage.labs) {
        expect(['planned', 'in-development']).toContain(lab.engineStatus);
      }
    });
  });

  describe('Starting-System template v2.0.0', () => {
    const template = readJson('data/circuit-templates/12v-starting-system-v2.json');

    test('is a standalone v2.0.0 template that extends v1.0.0', () => {
      expect(template.templateVersion).toBe('2.0.0');
      expect(template.extendsTemplateVersion).toBe('1.0.0');
      expect(template.templateRole).toBe('reusable-training-circuit-template');
      expect(template.systemKind).toBe('starting');
      expect(template.components).toHaveLength(7);
      expect(template.connections).toHaveLength(8);
      expect(template.operatingStates.length).toBeGreaterThanOrEqual(3);
    });

    test('declares each element parameter exactly once and targets a real component', () => {
      const componentIds = new Set(template.components.map((component) => component.id));
      const seen = new Set();
      for (const parameter of template.elementParameters) {
        expect(componentIds).toContain(parameter.elementId);
        const key = `${parameter.elementId}.${parameter.parameterId}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        expect(parameter.valueRole).toBe('generic_training_example');
        expect(Number.isFinite(parameter.value)).toBe(true);
      }
      expect(seen.size).toBe(template.elementParameters.length);
    });

    test('declares each conductor resistance exactly once and targets a real connection', () => {
      const connectionIds = new Set(template.connections.map((connection) => connection.id));
      const seen = new Set();
      for (const conductor of template.conductorResistances) {
        expect(connectionIds).toContain(conductor.connectionId);
        expect(seen.has(conductor.connectionId)).toBe(false);
        seen.add(conductor.connectionId);
        expect(conductor.resistanceOhm).toBeGreaterThan(0);
      }
      expect(seen.size).toBe(template.conductorResistances.length);
    });

    test('a relay-coupled contact is never independently actuated', () => {
      const coupledContacts = new Set(template.relayCouplings.map((coupling) => coupling.contactElementId));
      for (const state of template.elementStates) {
        for (const element of state.independentlyActuatedElements) {
          expect(coupledContacts.has(element.elementId)).toBe(false);
        }
      }
      expect(template.relayCouplings).toHaveLength(1);
      expect(template.relayCouplings[0].model).toBe('threshold-on-solved-coil-voltage');
      expect(template.relayCouplings[0].dynamics).toBe('quasi-static-declared');
      expect(template.relayCouplings[0].dynamicsNotice.length).toBeGreaterThan(40);
    });

    test('every fault class resolves to the canonical fault taxonomy', () => {
      const taxonomy = readJson('data/lmf/fault-taxonomy.json');
      const known = new Set(taxonomy.categories.map((category) => category.faultClassId));
      expect(template.faultCatalog.length).toBeGreaterThanOrEqual(5);
      for (const fault of template.faultCatalog) {
        expect(known).toContain(fault.faultClassId);
      }
    });

    test('declares that no numerical engine is implemented', () => {
      expect(template.engineeringBoundary.numericalEngineImplemented).toBe(false);
      expect(template.engineeringBoundary.disclosedSimplifications.length).toBeGreaterThanOrEqual(4);
      expect(template.engineeringBoundary.unsupportedElementClasses.length).toBeGreaterThanOrEqual(3);
    });

    test('preserves the 500 A fixed-current reference and its drop limits exactly', () => {
      const catalog = readJson('data/engineering/authoritative-specifications/delco-remy-starting-charging.json');
      const byId = new Map(catalog.specifications.map((spec) => [spec.id, spec]));

      const testLoad = byId.get('delco-starter-cable-test-load-12v');
      expect(testLoad).toBeDefined();
      expect(testLoad.comparison).toBe('exact');
      expect(testLoad.quantity.value).toBe(500);
      expect(testLoad.quantity.unit).toBe('A');
      expect(testLoad.applicability.systemVoltage).toBe(12);

      const limit37 = byId.get('delco-starter-total-drop-12v-37-42mt');
      const limit50 = byId.get('delco-starter-total-drop-12v-50mt');
      expect(limit37.comparison).toBe('maximum');
      expect(limit37.quantity.value).toBe(0.5);
      expect(limit50.comparison).toBe('maximum');
      expect(limit50.quantity.value).toBe(0.4);

      for (const referenceId of template.engineeringBoundary.fixedCurrentReferenceIds) {
        expect(byId.has(referenceId)).toBe(true);
      }
    });
  });

  describe('authority boundaries', () => {
    test('no prohibited authority field appears in any Gate 2B artifact', () => {
      const artifacts = [
        readJson('data/architecture/lab-domain-coverage.json'),
        readJson('data/circuit-templates/12v-starting-system-v2.json'),
        readJson('tests/simulators/starting-system-v2-expected-netlist.json'),
        readJson('tests/simulators/starting-system-v2-expected-values.json'),
        readJson('schemas/model-manifest.schema.json'),
        readJson('schemas/lab-domain-coverage.schema.json'),
        readJson('schemas/circuit-template-v2.schema.json')
      ];
      for (const artifact of artifacts) {
        for (const key of collectKeys(artifact)) {
          expect(FORBIDDEN_AUTHORITY_KEYS).not.toContain(key);
        }
      }
    });

    test('the contracts module exports every required interface', () => {
      const contractDir = path.join(root, 'contracts');
      const source = fs
        .readdirSync(contractDir)
        .filter((name) => name.endsWith('.ts'))
        .map((name) => fs.readFileSync(path.join(contractDir, name), 'utf8'))
        .join('\n');
      for (const name of REQUIRED_CONTRACT_NAMES) {
        const declared = new RegExp(`export\\s+(interface|type)\\s+${name}\\b`).test(source);
        expect({ name, declared }).toEqual({ name, declared: true });
      }
    });

    test('the contracts module carries no assessment or publication authority', () => {
      const contractDir = path.join(root, 'contracts');
      const source = fs
        .readdirSync(contractDir)
        .filter((name) => name.endsWith('.ts'))
        .map((name) => fs.readFileSync(path.join(contractDir, name), 'utf8'))
        .join('\n');
      for (const key of FORBIDDEN_AUTHORITY_KEYS) {
        expect(new RegExp(`readonly\\s+${key}\\s*[?:]`).test(source)).toBe(false);
      }
    });
  });
});
