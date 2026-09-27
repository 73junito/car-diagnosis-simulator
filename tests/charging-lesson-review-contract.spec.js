'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const lessonDoc = JSON.parse(fs.readFileSync(path.join(root, 'data', 'curriculum', 'lesson-content.json'), 'utf8'));
const externalRefs = JSON.parse(fs.readFileSync(path.join(root, 'data', 'evidence', 'external-technical-references.json'), 'utf8'));
const chargingCircuit = JSON.parse(fs.readFileSync(path.join(root, 'data', 'circuits', 'generic-charging-system.json'), 'utf8'));

describe('Charging lesson review corrections', () => {
  const plan = lessonDoc.lessonContentPlans.find((item) => item.lessonPlanId === 'ug-electrical-charging-system');

  test('uses component-parallel wording and explicit voltage-domain context', () => {
    expect(plan.learningObjectives[0].statement).toBe(
      'Explain the functional relationship among the battery, alternator, diode rectifier, voltage regulator, and vehicle electrical loads.'
    );

    const blocks = Object.fromEntries(plan.contentBlocks.map((block) => [block.id, block]));
    expect(blocks['charging-objectives'].teachingPoints).toContain(
      'Use a source reference only when its applicability matches the system, voltage domain, test method, and measurement context.'
    );
    expect(blocks['charging-prior-knowledge'].teachingPoints).toContain(
      'A measured number has meaning only when the operating condition, test location, voltage domain, and units are known.'
    );
    expect(blocks['charging-evidence-model'].teachingPoints).toContain(
      'A measurement is evidence only when the test point, operating state, voltage domain, units, and applicable reference are known.'
    );
  });

  test('supports the battery relationship with a citation-only external technical reference', () => {
    const block = plan.contentBlocks.find((item) => item.id === 'charging-system-model');
    expect(block.teachingPoints.some((point) => /alternator-battery-cable system/.test(point))).toBe(true);
    expect(block.evidenceReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'external-technical-reference',
          id: 'delco-remy-alternator-battery-relationship-2016'
        })
      ])
    );

    const source = externalRefs.sources.find((item) => item.source_id === 'delco-remy-alternator-battery-relationship-2016');
    expect(source).toBeTruthy();
    expect(source.evidence_role).toBe('external-technical-reference');
    expect(source.citation_allowed).toBe(true);
    expect(source.reusable_chunks_allowed).toBe(false);
    expect(source.ollama_eligible).toBe(false);
  });

  test('maps independent diagnostic scenarios to the diagnostic-reasoning objective', () => {
    const block = plan.contentBlocks.find((item) => item.id === 'charging-independent-scenario');
    expect(block.supportsObjectiveIds).toEqual(['ug-electrical-lo-3']);
    const scenarioRefs = block.evidenceReferences.filter((ref) => ref.type === 'scenario-mapping');
    expect(scenarioRefs).toHaveLength(2);
    for (const ref of scenarioRefs) {
      expect(ref.objectiveId).toBe('ug-electrical-lo-3');
    }
  });

  test('keeps cable-sizing references separate from diagnostic test procedures', () => {
    const worked = plan.contentBlocks.find((item) => item.id === 'charging-worked-example');
    expect(worked.teachingPoints[0]).toMatch(/charging-cable sizing table, not from a universal diagnostic voltage-drop test procedure/);
    expect(worked.teachingPoints[3]).toMatch(/relative to the two cited source values/);
    expect(worked.teachingPoints[3]).not.toMatch(/reference range/);
    expect(worked.sourceBoundary).toMatch(/not a vehicle specification or prescribed test result/);
    expect(worked.instructionalExample.requiredContextBeforeDiagnosticUse).toEqual(
      expect.arrayContaining([
        'cable path or conductor under evaluation',
        'voltage domain',
        'operating and load condition',
        'measurement test points',
        'applicable vehicle-specific diagnostic procedure'
      ])
    );
  });

  test('guided practice treats out-of-reference values as path evidence, not component diagnoses', () => {
    const guided = plan.contentBlocks.find((item) => item.id === 'charging-guided-practice');
    expect(guided.teachingPoints[1]).toMatch(/0\.500 V maximum for that source-scoped charging-cable context/);
    expect(guided.teachingPoints[1]).not.toMatch(/0\.500 V maximum basis/);
    expect(guided.teachingPoints[1]).toMatch(/outside that source-scoped reference/);
    expect(guided.teachingPoints[1]).toMatch(/does not identify which conductor, connection, or component is responsible/);
    expect(guided.sourceBoundary).toMatch(/does not by itself identify a failed component/);
  });

  test('independent scenarios expose answer-neutral training evidence packets', () => {
    const block = plan.contentBlocks.find((item) => item.id === 'charging-independent-scenario');
    expect(block.independentCases).toHaveLength(2);
    expect(block.independentCases.map((item) => item.scenarioId)).toEqual(['charging-system', 'electrical-load']);

    for (const caseItem of block.independentCases) {
      expect(caseItem.evidenceRole).toBe('project-authored-training-evidence');
      expect(caseItem.observations.length).toBeGreaterThanOrEqual(3);
      expect(caseItem.unknownsToResolve.length).toBeGreaterThanOrEqual(4);
      const serialized = JSON.stringify(caseItem);
      expect(serialized).not.toMatch(/"fault"\s*:/i);
      expect(serialized).not.toMatch(/"correct_answer"\s*:/i);
      expect(serialized).not.toMatch(/"interpretation"\s*:/i);
    }
  });

  test('reasoning check does not assess pending scholarly chunks as approved authority', () => {
    const block = plan.contentBlocks.find((item) => item.id === 'charging-reasoning-check');
    expect(block.teachingPoints[0]).toBe(
      'Check 1: explain the functional relationship among the battery, alternator, diode rectifier, voltage regulator, and vehicle electrical loads using the lesson system model and identify which parts require vehicle-specific verification.'
    );
    expect(JSON.stringify(block)).not.toMatch(/pending Frontiers technical-review chunks/i);
  });

  test('generic charging circuit supports the full lesson and exposes the load-feed test point', () => {
    expect(chargingCircuit.curriculum.supportsObjectiveIds).toEqual([
      'ug-electrical-lo-1',
      'ug-electrical-lo-2',
      'ug-electrical-lo-3'
    ]);
    expect(chargingCircuit.testPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'TP_LOAD_PWR',
          terminalId: 'LOAD1_PWR',
          measurementTypes: ['voltage'],
          vehicleSpecificValueRequired: true
        })
      ])
    );
  });
});
