describe('jest environment', () => {
  test('matchMedia exists', () => {
    expect(typeof window.matchMedia).toBe('function');
  });

  test('TextEncoder exists', () => {
    expect(typeof global.TextEncoder).toBe('function');
  });

  test('TextDecoder exists', () => {
    expect(typeof global.TextDecoder).toBe('function');
  });
});
