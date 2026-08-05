/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('node:crypto');

function loadScenarioScript() {
  const script = fs.readFileSync(
    path.resolve(process.cwd(), 'dashboard/student/scenario/scenario.js'),
    'utf8'
  );
  document.head.appendChild(
    Object.assign(document.createElement('script'), { textContent: script })
  );
}

function setupScenarioDom() {
  document.body.innerHTML = '<main><section id="scenarioPage" class="scenario-page"></section></main>';
}

function setScenarioRoute(id) {
  window.history.replaceState({}, '', `?id=${encodeURIComponent(id)}`);
}

function buildQuestions(count, prefix) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    list.push({
      id: `${prefix}-${i}`,
      question_text: `Question ${i} for ${prefix}`,
      option_a: 'A1',
      option_b: 'B1',
      option_c: 'C1',
      option_d: 'D1',
      correct_answer: 'A',
      topic: `Topic ${i}`
    });
  }
  return list;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('scenario attempt lifecycle', () => {
  beforeAll(() => {
    if (!globalThis.crypto?.getRandomValues) {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: webcrypto,
      });
    }
  });
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.head.innerHTML = '';
    setupScenarioDom();

    window.SUPABASE_URL = '';
    window.SUPABASE_ANON_KEY = '';

    window.SCENARIO_REGISTRY = [
      {
        id: 'scenario-1',
        numericId: 1,
        title: 'Scenario 1',
        shortSymptom: 'Test symptom',
        category: 'Electrical',
        raw: {
          id: '1',
          title: 'Scenario 1',
          symptoms: 'Test symptom',
          trainingFocus: 'Electrical',
          primarySystem: 'Charging',
          secondarySystems: ['Starting'],
          requiredTools: ['Scan Tool']
        }
      }
    ];

    window.SCENARIO_QUESTIONS = {
      'scenario-1': buildQuestions(30, 'scenario-1')
    };

    global.fetch = jest.fn(async (url) => {
      if (typeof url === 'string' && url.includes('/api/attempts/save')) {
        return { ok: true, json: async () => ({ ok: true, id: 'attempt-1' }) };
      }
      if (typeof url === 'string' && url.includes('/api/torquemind-feedback')) {
        return {
          ok: true,
          json: async () => ({
            reasonIncorrect: 'incorrect rationale',
            reasonCorrect: 'correct rationale',
            aseConcept: 'ase concept',
            nextStep: 'next step'
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  test('creates an active attempt with exactly 20 unique questions', async () => {
    setScenarioRoute('scenario-1');
    loadScenarioScript();
    await flush();

    const cards = Array.from(document.querySelectorAll('.question-card'));
    expect(cards).toHaveLength(20);

    const ids = cards.map((card) => card.dataset.questionQid);
    expect(new Set(ids).size).toBe(20);

    const stateKey = Object.keys(localStorage).find((k) => k.startsWith('torquemind.scenario.attempt.scenario-1.'));
    expect(stateKey).toBeTruthy();
    const state = JSON.parse(localStorage.getItem(stateKey));
    expect(state.activeAttempt).toBeTruthy();
    expect(state.activeAttempt.questionIds).toHaveLength(20);
  });

  test('keeps the same question set across reload while attempt is active', async () => {
    setScenarioRoute('scenario-1');
    loadScenarioScript();
    await flush();

    const firstIds = Array.from(document.querySelectorAll('.question-card'))
      .map((card) => card.dataset.questionQid);

    setupScenarioDom();
    loadScenarioScript();
    await flush();

    const secondIds = Array.from(document.querySelectorAll('.question-card'))
      .map((card) => card.dataset.questionQid);

    expect(secondIds).toEqual(firstIds);
  });

  test('after three failed attempts, next attempt avoids previous failed question ids when possible', async () => {
    const studentId = 'student-fixed';
    localStorage.setItem('torquemind.student.id', studentId);

    const failedIdsA = buildQuestions(20, 'scenario-1').map((q) => q.id);
    const failedIdsB = buildQuestions(20, 'scenario-1-b').map((q) => q.id);
    const failedIdsC = buildQuestions(20, 'scenario-1-c').map((q) => q.id);

    window.SCENARIO_QUESTIONS['scenario-1'] = [
      ...buildQuestions(20, 'scenario-1'),
      ...buildQuestions(20, 'scenario-1-b'),
      ...buildQuestions(20, 'scenario-1-c'),
      ...buildQuestions(20, 'scenario-1-fresh')
    ];

    const seededState = {
      moduleId: 'scenario-1',
      studentId,
      activeAttempt: null,
      history: [
        {
          moduleId: 'scenario-1',
          studentId,
          attemptNumber: 1,
          questionIds: failedIdsA,
          score: 55,
          passed: false,
          completedAt: new Date().toISOString()
        },
        {
          moduleId: 'scenario-1',
          studentId,
          attemptNumber: 2,
          questionIds: failedIdsB,
          score: 60,
          passed: false,
          completedAt: new Date().toISOString()
        },
        {
          moduleId: 'scenario-1',
          studentId,
          attemptNumber: 3,
          questionIds: failedIdsC,
          score: 65,
          passed: false,
          completedAt: new Date().toISOString()
        }
      ]
    };

    localStorage.setItem(
      `torquemind.scenario.attempt.scenario-1.${studentId}`,
      JSON.stringify(seededState)
    );

    setScenarioRoute('scenario-1');
    loadScenarioScript();
    await flush();

    const state = JSON.parse(
      localStorage.getItem(`torquemind.scenario.attempt.scenario-1.${studentId}`)
    );

    expect(state.activeAttempt).toBeTruthy();
    expect(state.activeAttempt.attemptNumber).toBe(4);
    expect(state.activeAttempt.questionIds).toHaveLength(20);

    const previous = new Set([...failedIdsA, ...failedIdsB, ...failedIdsC]);
    const overlap = state.activeAttempt.questionIds.filter((id) => previous.has(id));
    expect(overlap).toHaveLength(0);
  });
});
