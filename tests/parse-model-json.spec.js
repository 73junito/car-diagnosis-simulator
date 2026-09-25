const { parseModelJson } = require('../scripts/lib/parse-model-json');

describe('parseModelJson', () => {
  test('parses direct JSON', () => {
    expect(parseModelJson('{"questions":[]}')).toEqual({ questions: [] });
  });

  test('parses fenced JSON', () => {
    const fence = '`'.repeat(3);
    expect(parseModelJson(`${fence}json\n{"questions":[{"id":1}]}\n${fence}`))
      .toEqual({ questions: [{ id: 1 }] });
  });

  test('extracts a JSON object from explanatory text', () => {
    expect(parseModelJson('Here is the requested JSON:\n{"questions":[]}\nDone.'))
      .toEqual({ questions: [] });
  });

  test('accepts already parsed objects', () => {
    const payload = { questions: [{ id: 1 }] };
    expect(parseModelJson(payload)).toBe(payload);
  });

  test('fails closed when no valid JSON object exists', () => {
    expect(() => parseModelJson('not json')).toThrow(
      'Model response did not contain a valid JSON object.'
    );
  });
});
