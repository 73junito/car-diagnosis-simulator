const VC = require('../../dashboard/student/aut250-lab-assets/src/vehicle-components');

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  return host;
}

const COMPONENTS = [
  {
    id: 'battery', label: 'Supplied battery', category: 'battery',
    description: 'Supplied description', terminals: [{ id: 'positive', label: 'Positive', role: 'power' }]
  },
  { id: 'cylinder', label: 'Supplied cylinder', category: 'cylinder', terminals: [] },
  { id: 'locked', label: 'Supplied locked part', category: 'connector', highlightable: false, terminals: [] }
];

describe('AUT-250 lab assets — vehicle component library', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  test('states that nothing is supplied and renders no components initially', () => {
    const library = VC.createComponentLibrary({ mount: mount() });
    expect(library.mount.textContent).toMatch(/No components supplied/);
    expect(library.mount.querySelectorAll('[data-component-id]')).toHaveLength(0);
  });

  test('renders each supported category as a labelled, keyboard-focusable control', () => {
    const library = VC.createComponentLibrary({ mount: mount() });
    const result = library.setComponents(COMPONENTS);
    expect(result.componentCount).toBe(3);
    const buttons = library.mount.querySelectorAll('button[data-component-id]');
    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => {
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('aria-pressed')).toBe('false');
      expect(button.getAttribute('aria-describedby')).toBeTruthy();
      expect(button.querySelector('svg').getAttribute('role')).toBe('img');
    });
    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);
  });

  test('selection is exposed through aria-pressed and the inspection panel', () => {
    const library = VC.createComponentLibrary({ mount: mount() });
    library.setComponents(COMPONENTS);
    expect(library.select('battery').ok).toBe(true);
    const button = library.mount.querySelector('[data-component-id="battery"]');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.classList.contains('tm-part--selected')).toBe(true);
    const detail = library.mount.querySelector('.tm-parts__detail').textContent;
    expect(detail).toMatch(/Supplied battery/);
    expect(detail).toMatch(/Supplied description/);
    expect(detail).toMatch(/Positive \[power\]/);
    expect(library.select('missing').ok).toBe(false);
  });

  test('highlighting is presentation state and respects non-highlightable parts', () => {
    const library = VC.createComponentLibrary({ mount: mount() });
    library.setComponents(COMPONENTS);
    expect(library.setHighlight('battery', true).ok).toBe(true);
    expect(library.isHighlighted('battery')).toBe(true);
    expect(library.mount.querySelector('[data-component-id="battery"]').classList.contains('tm-part--highlighted')).toBe(true);
    const refused = library.setHighlight('locked', true);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toMatch(/not highlightable/);
    expect(library.setHighlight('missing', true).ok).toBe(false);
  });

  test('unsupported categories and malformed entries fall back explicitly', () => {
    const library = VC.createComponentLibrary({ mount: mount() });
    const result = library.setComponents([
      { id: 'odd', label: 'Supplied odd part', category: 'not-a-category' },
      { label: 'no id' }
    ]);
    expect(result.componentCount).toBe(1);
    expect(result.issues.join(' ')).toMatch(/unsupported category/);
    expect(result.issues.join(' ')).toMatch(/requires an id/);
    const button = library.mount.querySelector('[data-component-id="odd"]');
    expect(button.querySelector('svg').getAttribute('aria-label')).toMatch(/generic/);
    expect(button.textContent).toMatch(/not-a-category/);
  });

  test('normalization keeps supplied labels and never adds specifications', () => {
    const normalized = VC.normalizeComponent({ id: 'x', category: 'battery' });
    expect(normalized.component.label).toBe('x');
    expect(normalized.component.description).toBeNull();
    expect(Object.keys(normalized.component)).not.toContain('voltageRating');
    expect(VC.SUPPORTED_CATEGORIES).toEqual([
      'battery', 'ignition-coil', 'spark-plug', 'wiring-harness',
      'connector', 'cylinder', 'ground', 'circuit-power', 'circuit-signal'
    ]);
  });
});
