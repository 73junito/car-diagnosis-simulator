const { groundTutorResponse, extractCitationLabels, validateAnswerCitations } = require('../src/tutor/groundingService');

describe('groundTutorResponse', () => {
  test('grounded happy path', async () => {
    const retrieval = jest.fn().mockResolvedValue({ status: 'sufficient', evidence: [{ id: 1 }] });
    const assembler = jest.fn().mockResolvedValue({
      status: 'ready',
      citations: [{ label: 'C1', sourceId: 'source-001', chunkId: 'chunk-001', locator: 'L1', title: 'Approved Source', pageStart: 118, pageEnd: 121 }],
      promptEvidence: ['[C1] starter circuit evidence']
    });
    const generator = jest.fn().mockResolvedValue('Inspect the starter control circuit before replacing the starter. [C1]');

    const out = await groundTutorResponse({ query: 'starter no crank', retrieval, assembler, generator });

    expect(out.status).toBe('grounded');
    expect(out.answer).toContain('[C1]');
    expect(out.citations[0].label).toBe('C1');
    expect(out.reason).toBeNull();
    expect(generator).toHaveBeenCalledTimes(1);
  });

  test('retrieval-insufficient fail-close', async () => {
    const retrieval = jest.fn().mockResolvedValue({ status: 'insufficient', reason: 'INSUFFICIENT_APPROVED_EVIDENCE' });
    const assembler = jest.fn();
    const generator = jest.fn();

    const out = await groundTutorResponse({ query: 'x', retrieval, assembler, generator });
    expect(out).toEqual({ status: 'insufficient', answer: null, citations: [], reason: 'INSUFFICIENT_APPROVED_EVIDENCE' });
    expect(assembler).not.toHaveBeenCalled();
    expect(generator).not.toHaveBeenCalled();
  });

  test('assembler-invalid fail-close', async () => {
    const retrieval = jest.fn().mockResolvedValue({ status: 'sufficient', evidence: [{ id: 1 }] });
    const assembler = jest.fn().mockResolvedValue({ status: 'insufficient', reason: 'INVALID_OR_INCOMPLETE_CITATIONS' });
    const generator = jest.fn();

    const out = await groundTutorResponse({ query: 'x', retrieval, assembler, generator });
    expect(out).toEqual({ status: 'insufficient', answer: null, citations: [], reason: 'INVALID_OR_INCOMPLETE_CITATIONS' });
    expect(generator).not.toHaveBeenCalled();
  });

  test('generator not called when approved evidence is empty', async () => {
    const retrieval = jest.fn().mockResolvedValue({ status: 'sufficient', evidence: [{ id: 1 }] });
    const assembler = jest.fn().mockResolvedValue({ status: 'ready', citations: [], promptEvidence: [] });
    const generator = jest.fn();

    const out = await groundTutorResponse({ query: 'x', retrieval, assembler, generator });
    expect(out.status).toBe('insufficient');
    expect(out.reason).toBe('INSUFFICIENT_APPROVED_EVIDENCE');
    expect(generator).not.toHaveBeenCalled();
  });

  test('unknown citation label rejected', async () => {
    const retrieval = jest.fn().mockResolvedValue({ status: 'sufficient', evidence: [{ id: 1 }] });
    const assembler = jest.fn().mockResolvedValue({
      status: 'ready',
      citations: [{ label: 'C1', sourceId: 'source-001', chunkId: 'chunk-001', locator: 'L1' }],
      promptEvidence: ['[C1] evidence']
    });
    const generator = jest.fn().mockResolvedValue('Replace the starter relay. [C2]');

    const out = await groundTutorResponse({ query: 'x', retrieval, assembler, generator });
    expect(out.status).toBe('insufficient');
    expect(out.reason).toBe('UNKNOWN_CITATION_LABEL');
  });

  test('answer without required citations rejected', async () => {
    const retrieval = jest.fn().mockResolvedValue({ status: 'sufficient', evidence: [{ id: 1 }] });
    const assembler = jest.fn().mockResolvedValue({
      status: 'ready',
      citations: [{ label: 'C1', sourceId: 'source-001', chunkId: 'chunk-001', locator: 'L1' }],
      promptEvidence: ['[C1] evidence']
    });
    const generator = jest.fn().mockResolvedValue('Check starter relay and wiring.');

    const out = await groundTutorResponse({ query: 'x', retrieval, assembler, generator });
    expect(out.status).toBe('insufficient');
    expect(out.reason).toBe('MISSING_REQUIRED_CITATIONS');
  });

  test('citation labels preserved', async () => {
    const retrieval = jest.fn().mockResolvedValue({ status: 'sufficient', evidence: [{ id: 1 }] });
    const citations = [
      { label: 'C1', sourceId: 'source-001', chunkId: 'chunk-001', locator: 'L1' },
      { label: 'C2', sourceId: 'source-001', chunkId: 'chunk-002', locator: 'L2' }
    ];
    const assembler = jest.fn().mockResolvedValue({ status: 'ready', citations, promptEvidence: ['[C1] a', '[C2] b'] });
    const generator = jest.fn().mockResolvedValue('Do checks in order. [C1] [C2]');

    const out = await groundTutorResponse({ query: 'x', retrieval, assembler, generator });
    expect(out.status).toBe('grounded');
    expect(out.citations.map(c => c.label)).toEqual(['C1', 'C2']);
  });

  test('empty query rejected', async () => {
    const retrieval = jest.fn();
    const assembler = jest.fn();
    const generator = jest.fn();

    const out = await groundTutorResponse({ query: '', retrieval, assembler, generator });
    expect(out.status).toBe('insufficient');
    expect(out.reason).toBe('EMPTY_QUERY');
    expect(retrieval).not.toHaveBeenCalled();
    expect(generator).not.toHaveBeenCalled();
  });

  test('generator exception mapped to controlled error', async () => {
    const retrieval = jest.fn().mockResolvedValue({ status: 'sufficient', evidence: [{ id: 1 }] });
    const assembler = jest.fn().mockResolvedValue({
      status: 'ready',
      citations: [{ label: 'C1', sourceId: 'source-001', chunkId: 'chunk-001', locator: 'L1' }],
      promptEvidence: ['[C1] evidence']
    });
    const generator = jest.fn().mockRejectedValue(new Error('provider timeout'));

    const out = await groundTutorResponse({ query: 'x', retrieval, assembler, generator });
    expect(out.status).toBe('insufficient');
    expect(out.reason).toBe('GENERATION_FAILED');
  });
});

describe('citation helpers', () => {
  test('extractCitationLabels parses deterministically', () => {
    expect(extractCitationLabels('A [C2] and [C1] and [C2]')).toEqual(['C1', 'C2']);
  });

  test('validateAnswerCitations rejects unknown labels', () => {
    const out = validateAnswerCitations('Use [C1] then [C3]', new Set(['C1', 'C2']));
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('UNKNOWN_CITATION_LABEL');
  });
});
