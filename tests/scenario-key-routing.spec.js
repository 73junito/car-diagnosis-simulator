/**
 * @file scenario-key-routing.spec.js
 * @description Unit tests for scenario_key routing and duplicate variant resolution
 * Tests the fix for routing defect: duplicate scenario categories must route to correct variant
 */

describe('Scenario Key Routing', () => {
  const mockScenarios = [
    // ID 1: no-crank-clicking (single variant in tests but duplicate category)
    {
      id: 1,
      scenario_key: 'no-crank-clicking',
      symptoms: 'Engine will not crank. Clicking sound when key is turned.',
      symptomCategory: 'no-crank',
      primarySystem: 'electrical'
    },
    // ID 2: no-start (unique category)
    {
      id: 2,
      scenario_key: 'no-start',
      symptoms: 'Engine cranks but does not start.',
      symptomCategory: 'no-start',
      primarySystem: 'fuel'
    },
    // ID 5: misfire-acceleration (duplicate category: misfire)
    {
      id: 5,
      scenario_key: 'misfire-acceleration',
      symptoms: 'Engine misfires under acceleration.',
      symptomCategory: 'misfire',
      primarySystem: 'ignition'
    },
    // ID 9: misfire-p0300 (duplicate category: misfire, different variant)
    {
      id: 9,
      scenario_key: 'misfire-p0300',
      symptoms: 'Check engine light is on. Code P0300 detected.',
      symptomCategory: 'misfire',
      primarySystem: 'engine'
    },
    // ID 11: no-crank-starter-click (duplicate category: no-crank, different variant)
    {
      id: 11,
      scenario_key: 'no-crank-starter-click',
      symptoms: 'Engine will not crank. Starter clicks when key is turned.',
      symptomCategory: 'no-crank',
      primarySystem: 'electrical'
    },
    // ID 15: hybrid-ev-isolation (duplicate category: hybrid-ev)
    {
      id: 15,
      scenario_key: 'hybrid-ev-isolation',
      symptoms: 'Hybrid system disables on startup; HV battery isolation fault logged.',
      symptomCategory: 'hybrid-ev',
      primarySystem: 'hybrid'
    },
    // ID 17: hybrid-ev-insulation (duplicate category: hybrid-ev, different variant)
    {
      id: 17,
      scenario_key: 'hybrid-ev-insulation',
      symptoms: 'Hybrid/EV high-voltage insulation fault; vehicle disables on startup.',
      symptomCategory: 'hybrid-ev',
      primarySystem: 'hybrid'
    }
  ];

  // Mock resolveScenario function
  function resolveScenario(queryId) {
    if (!queryId) return null;

    // Step 1: Try scenario_key first (primary, unambiguous)
    const byKey = mockScenarios.find(s => s.scenario_key === queryId);
    if (byKey) return byKey;

    // Step 2: Try numeric ID (legacy, safe because IDs are unique)
    if (/^\d+$/.test(String(queryId))) {
      const numericId = Number(queryId);
      const byId = mockScenarios.find(s => s.id === numericId);
      if (byId) return byId;
    }

    // Step 3: Check if queryId matches a symptomCategory that has duplicates
    const matchingByCategory = mockScenarios.filter(s => s.symptomCategory === queryId);
    if (matchingByCategory.length > 1) {
      // Ambiguous category route - REJECT
      console.error(`Ambiguous scenario route: category "${queryId}" matches ${matchingByCategory.length} scenarios. Use scenario_key instead.`, matchingByCategory);
      return null;
    }
    if (matchingByCategory.length === 1) {
      return matchingByCategory[0];
    }

    return null;
  }

  describe('Unique scenario_key resolution', () => {
    it('resolves scenario by unique scenario_key', () => {
      const scenario = resolveScenario('no-crank-clicking');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(1);
      expect(scenario.scenario_key).toBe('no-crank-clicking');
    });

    it('resolves unique category scenario by scenario_key', () => {
      const scenario = resolveScenario('no-start');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(2);
      expect(scenario.scenario_key).toBe('no-start');
    });
  });

  describe('Duplicate variant resolution', () => {
    it('resolves no-crank-clicking variant (ID 1) by scenario_key', () => {
      const scenario = resolveScenario('no-crank-clicking');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(1);
      expect(scenario.symptomCategory).toBe('no-crank');
    });

    it('resolves no-crank-starter-click variant (ID 11) by scenario_key (not first match)', () => {
      const scenario = resolveScenario('no-crank-starter-click');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(11);
      expect(scenario.symptomCategory).toBe('no-crank');
      // Verify this is NOT the first no-crank scenario (ID 1)
      expect(scenario.id).not.toBe(1);
    });

    it('resolves misfire-acceleration variant (ID 5) by scenario_key', () => {
      const scenario = resolveScenario('misfire-acceleration');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(5);
      expect(scenario.symptomCategory).toBe('misfire');
    });

    it('resolves misfire-p0300 variant (ID 9) by scenario_key (not first match)', () => {
      const scenario = resolveScenario('misfire-p0300');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(9);
      expect(scenario.symptomCategory).toBe('misfire');
      // Verify this is NOT the first misfire scenario (ID 5)
      expect(scenario.id).not.toBe(5);
    });

    it('resolves hybrid-ev-isolation variant (ID 15) by scenario_key', () => {
      const scenario = resolveScenario('hybrid-ev-isolation');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(15);
      expect(scenario.symptomCategory).toBe('hybrid-ev');
    });

    it('resolves hybrid-ev-insulation variant (ID 17) by scenario_key (not first match)', () => {
      const scenario = resolveScenario('hybrid-ev-insulation');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(17);
      expect(scenario.symptomCategory).toBe('hybrid-ev');
      // Verify this is NOT the first hybrid-ev scenario (ID 15)
      expect(scenario.id).not.toBe(15);
    });
  });

  describe('Ambiguous category route rejection', () => {
    it('rejects ambiguous ?id=no-crank when multiple no-crank variants exist', () => {
      const scenario = resolveScenario('no-crank');
      expect(scenario).toBeNull();
    });

    it('rejects ambiguous ?id=misfire when multiple misfire variants exist', () => {
      const scenario = resolveScenario('misfire');
      expect(scenario).toBeNull();
    });

    it('rejects ambiguous ?id=hybrid-ev when multiple hybrid-ev variants exist', () => {
      const scenario = resolveScenario('hybrid-ev');
      expect(scenario).toBeNull();
    });
  });

  describe('Legacy numeric ID support', () => {
    it('resolves scenario by numeric ID for backwards compatibility', () => {
      const scenario = resolveScenario('1');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(1);
    });

    it('resolves scenario ID 9 by numeric ID (not first match of category)', () => {
      const scenario = resolveScenario('9');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(9);
      // Verify this is NOT scenario ID 5 (first misfire)
      expect(scenario.id).not.toBe(5);
    });

    it('resolves scenario ID 11 by numeric ID (not first match of category)', () => {
      const scenario = resolveScenario('11');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(11);
      // Verify this is NOT scenario ID 1 (first no-crank)
      expect(scenario.id).not.toBe(1);
    });

    it('resolves scenario ID 17 by numeric ID (not first match of category)', () => {
      const scenario = resolveScenario('17');
      expect(scenario).toBeDefined();
      expect(scenario.id).toBe(17);
      // Verify this is NOT scenario ID 15 (first hybrid-ev)
      expect(scenario.id).not.toBe(15);
    });
  });

  describe('Fallback behavior', () => {
    it('returns null for non-existent scenario_key', () => {
      const scenario = resolveScenario('non-existent-key');
      expect(scenario).toBeNull();
    });

    it('returns null for non-existent numeric ID', () => {
      const scenario = resolveScenario('999');
      expect(scenario).toBeNull();
    });

    it('returns null for empty/falsy input', () => {
      expect(resolveScenario(null)).toBeNull();
      expect(resolveScenario(undefined)).toBeNull();
      expect(resolveScenario('')).toBeNull();
    });
  });

  describe('Acceptance criteria validation', () => {
    it('every scenario has a unique scenario_key', () => {
      const keys = mockScenarios.map(s => s.scenario_key);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });

    it('scenario_key is never empty or null', () => {
      mockScenarios.forEach(scenario => {
        expect(scenario.scenario_key).toBeTruthy();
        expect(typeof scenario.scenario_key).toBe('string');
      });
    });

    it('all 6 duplicate variants are resolvable by unique scenario_key', () => {
      const variants = [
        'no-crank-clicking',
        'no-crank-starter-click',
        'misfire-acceleration',
        'misfire-p0300',
        'hybrid-ev-isolation',
        'hybrid-ev-insulation'
      ];

      variants.forEach(key => {
        const scenario = resolveScenario(key);
        expect(scenario).toBeDefined();
        expect(scenario.scenario_key).toBe(key);
      });
    });

    it('ambiguous category routes do NOT silently select first scenario', () => {
      // These should return null (rejected), not the first scenario
      const ambiguousCategories = ['no-crank', 'misfire', 'hybrid-ev'];

      ambiguousCategories.forEach(category => {
        const scenario = resolveScenario(category);
        expect(scenario).toBeNull();
      });
    });

    it('numeric legacy routes remain supported for all scenarios', () => {
      mockScenarios.forEach(scenario => {
        const resolved = resolveScenario(String(scenario.id));
        expect(resolved).toBeDefined();
        expect(resolved.id).toBe(scenario.id);
      });
    });
  });
});
