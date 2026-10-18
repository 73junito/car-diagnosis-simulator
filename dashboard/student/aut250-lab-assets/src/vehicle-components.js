/**
 * AUT-250 Interactive Laboratory Assets — reusable vehicle electrical
 * component library.
 *
 * Components are project-authored training geometry. The library renders the
 * label, category, terminal list, and description supplied by the provider;
 * it does not attach specifications, voltage ratings, or diagnostic meaning
 * of its own. Selecting or highlighting a component is presentation state
 * only and produces no assessment outcome.
 *
 * UMD: window.Aut250LabAssets.VehicleComponents and require().
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var dc = isNode ? require('./data-contract') : (root && root.Aut250LabAssets && root.Aut250LabAssets.DataContract);
  var api = factory(dc);
  if (isNode) module.exports = api;
  if (root) {
    root.Aut250LabAssets = root.Aut250LabAssets || {};
    root.Aut250LabAssets.VehicleComponents = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function (DC) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SUPPORTED_CATEGORIES = [
    'battery', 'ignition-coil', 'spark-plug', 'wiring-harness',
    'connector', 'cylinder', 'ground', 'circuit-power', 'circuit-signal'
  ];
  var instanceSeq = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    }
    return node;
  }

  function shapeRect(x, y, width, height, radius) {
    return svgEl('rect', {
      x: x, y: y, width: width, height: height, rx: radius || 0, ry: radius || 0,
      class: 'tm-part__body'
    });
  }

  function shapeLine(x1, y1, x2, y2, className) {
    return svgEl('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: className || 'tm-part__lead' });
  }

  function shapeCircle(cx, cy, r, className) {
    return svgEl('circle', { cx: cx, cy: cy, r: r, class: className || 'tm-part__node' });
  }

  function shapePath(d, className) {
    return svgEl('path', { d: d, class: className || 'tm-part__body' });
  }

  function normalizeComponent(raw) {
    if (!DC.isPlainObject(raw)) {
      return { ok: false, issues: ['Component entry must be an object.'], component: null };
    }
    if (!DC.nonEmptyString(raw.id)) {
      return { ok: false, issues: ['Component requires an id.'], component: null };
    }
    var issues = [];
    var category = DC.nonEmptyString(raw.category) ? raw.category : null;
    if (!category) {
      issues.push('Component ' + raw.id + ' has no category; a generic training shape is shown.');
    } else if (SUPPORTED_CATEGORIES.indexOf(category) === -1) {
      issues.push('Component ' + raw.id + ' uses unsupported category "' + category + '"; a generic training shape is shown.');
    }
    var terminals = [];
    DC.asArray(raw.terminals).forEach(function (terminal, index) {
      if (!DC.isPlainObject(terminal) || !DC.nonEmptyString(terminal.id)) {
        issues.push('Component ' + raw.id + ' terminal ' + index + ' ignored: an id is required.');
        return;
      }
      terminals.push({
        id: terminal.id,
        label: DC.nonEmptyString(terminal.label) ? terminal.label : terminal.id,
        role: DC.nonEmptyString(terminal.role) ? terminal.role : null
      });
    });
    return {
      ok: true,
      issues: issues,
      component: {
        id: raw.id,
        label: DC.nonEmptyString(raw.label) ? raw.label : raw.id,
        category: SUPPORTED_CATEGORIES.indexOf(category) === -1 ? 'generic' : category,
        declaredCategory: category,
        description: DC.nonEmptyString(raw.description) ? raw.description : null,
        terminals: terminals,
        highlightable: raw.highlightable === false ? false : true
      }
    };
  }

  // Project-authored training geometry. Shapes are neutral: no rating,
  // specification, or diagnostic meaning is implied by the artwork.
  var SHAPES = {
    battery: function (svg) {
      svg.append(shapeRect(18, 34, 84, 46, 6), shapeRect(34, 24, 14, 12, 2), shapeRect(72, 24, 14, 12, 2),
        shapeLine(20, 58, 100, 58, 'tm-part__detail'));
    },
    'ignition-coil': function (svg) {
      svg.append(shapeRect(40, 22, 40, 64, 6), shapeRect(52, 12, 16, 12, 2),
        shapeCircle(60, 54, 10, 'tm-part__detail'), shapeLine(60, 86, 60, 100));
    },
    'spark-plug': function (svg) {
      svg.append(shapeRect(52, 14, 16, 44, 3), shapeRect(44, 58, 32, 14, 3),
        shapePath('M56 72 L64 72 L64 88 L60 96 L56 88 Z'), shapeLine(60, 96, 60, 104));
    },
    'wiring-harness': function (svg) {
      svg.append(shapePath('M14 40 C 40 20, 60 60, 86 40 S 106 20, 106 20', 'tm-part__lead'),
        shapePath('M14 62 C 40 42, 60 82, 86 62 S 106 42, 106 42', 'tm-part__lead'),
        shapeCircle(14, 40, 4), shapeCircle(14, 62, 4), shapeCircle(106, 20, 4), shapeCircle(106, 42, 4));
    },
    connector: function (svg) {
      svg.append(shapeRect(26, 38, 68, 40, 6), shapeCircle(42, 58, 6), shapeCircle(60, 58, 6), shapeCircle(78, 58, 6),
        shapeLine(94, 58, 110, 58));
    },
    cylinder: function (svg) {
      svg.append(shapeRect(34, 16, 52, 66, 8), shapePath('M34 62 A 26 12 0 0 0 86 62', 'tm-part__detail'),
        shapeLine(60, 82, 60, 102));
    },
    ground: function (svg) {
      svg.append(shapeLine(60, 12, 60, 54), shapeLine(26, 54, 94, 54), shapeLine(38, 68, 82, 68),
        shapeLine(50, 82, 70, 82));
    },
    'circuit-power': function (svg) {
      svg.append(shapeLine(14, 58, 106, 58, 'tm-part__lead'),
        shapeCircle(38, 58, 9, 'tm-part__node--power'), shapeCircle(82, 58, 9, 'tm-part__node--power'),
        shapePath('M52 30 L68 30 L60 44 Z', 'tm-part__detail'));
    },
    'circuit-signal': function (svg) {
      svg.append(shapePath('M14 70 L34 70 L34 40 L58 40 L58 70 L82 70 L82 40 L106 40', 'tm-part__lead'),
        shapeCircle(34, 40, 5), shapeCircle(58, 40, 5), shapeCircle(82, 40, 5));
    },
    generic: function (svg) {
      svg.append(shapeRect(30, 30, 60, 60, 8), shapeCircle(60, 60, 12, 'tm-part__detail'));
    }
  };

  function renderShape(svg, component) {
    var draw = SHAPES[component.category] || SHAPES.generic;
    draw(svg);
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', component.label + ' training component illustration (' + component.category + ').');
  }


  /**
   * @param {{mount: Element, onSelect?: Function}} options
   */
  function createComponentLibrary(options) {
    var opts = options || {};
    var mount = opts.mount;
    if (!mount) throw new Error('Component library requires a mount element.');
    var onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : null;
    instanceSeq += 1;
    var uid = 'parts-' + instanceSeq;

    var state = { components: [], issues: [], selectedId: null, highlighted: {}, rotation: 0 };

    var rootEl = el('section', 'tm-parts');
    rootEl.setAttribute('aria-labelledby', uid + '-title');

    var header = el('header', 'tm-asset__header');
    var title = el('h3', 'tm-asset__title', 'Vehicle electrical components');
    title.id = uid + '-title';
    header.append(title, el('p', 'tm-asset__badge',
      'SIMULATED TRAINING GEOMETRY · labels and terminals are supplied by an external provider'));

    var controls = el('div', 'tm-parts__controls');
    var rotationLabel = el('label', 'tm-asset__label', 'View angle (presentation only)');
    rotationLabel.setAttribute('for', uid + '-rotation');
    var rotationInput = el('input', 'tm-asset__range');
    rotationInput.id = uid + '-rotation';
    rotationInput.type = 'range';
    rotationInput.min = '-24';
    rotationInput.max = '24';
    rotationInput.step = '2';
    rotationInput.value = '0';
    rotationInput.addEventListener('input', function () {
      state.rotation = Number(rotationInput.value);
      stage.style.transform = 'rotateY(' + state.rotation + 'deg) rotateX(' + Math.round(state.rotation / 3) + 'deg)';
    });
    controls.append(rotationLabel, rotationInput);

    var stage = el('div', 'tm-parts__stage');
    var grid = el('div', 'tm-parts__grid');
    stage.append(grid);

    var detail = el('aside', 'tm-parts__detail');
    detail.setAttribute('aria-live', 'polite');

    var issuesEl = el('p', 'tm-asset__issues', '');
    issuesEl.setAttribute('role', 'status');
    issuesEl.setAttribute('aria-live', 'polite');

    rootEl.append(header, controls, stage, detail, issuesEl);
    mount.append(rootEl);

    function renderDetail() {
      detail.replaceChildren();
      var component = componentById(state.selectedId);
      if (!component) {
        detail.append(el('h4', null, 'Component inspection'), el('p', 'tm-asset__hint', 'Select a component to inspect it.'));
        return;
      }
      detail.append(el('h4', null, 'Component inspection — ' + component.label));
      var list = el('dl', 'tm-parts__facts');
      var facts = [
        ['Identifier (supplied)', component.id],
        ['Category (supplied)', component.declaredCategory || 'not supplied'],
        ['Description (supplied)', component.description || 'not supplied'],
        ['Terminals (supplied)', component.terminals.length
          ? component.terminals.map(function (terminal) {
            return terminal.label + (terminal.role ? ' [' + terminal.role + ']' : '');
          }).join(', ')
          : 'not supplied']
      ];
      facts.forEach(function (pair) {
        list.append(el('dt', null, pair[0]), el('dd', null, pair[1]));
      });
      detail.append(list);
    }

    function componentById(id) {
      for (var i = 0; i < state.components.length; i += 1) {
        if (state.components[i].id === id) return state.components[i];
      }
      return null;
    }

    function select(id) {
      var component = componentById(id);
      if (!component) return { ok: false, reason: 'Unknown component: ' + String(id) };
      state.selectedId = id;
      updateButtonStates();
      renderDetail();
      if (onSelect) onSelect(component);
      return { ok: true, component: component };
    }

    function updateButtonStates() {
      Array.prototype.forEach.call(grid.querySelectorAll('[data-component-id]'), function (button) {
        var id = button.getAttribute('data-component-id');
        var isSelected = id === state.selectedId;
        button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        button.classList.toggle('tm-part--selected', isSelected);
        button.classList.toggle('tm-part--highlighted', Boolean(state.highlighted[id]));
      });
    }


    function renderGrid() {
      grid.replaceChildren();
      if (state.components.length === 0) {
        grid.append(el('p', 'tm-asset__hint', 'No components supplied by the provider.'));
        return;
      }
      state.components.forEach(function (component) {
        var button = el('button', 'tm-part');
        button.type = 'button';
        button.setAttribute('data-component-id', component.id);
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-describedby', uid + '-desc-' + component.id);
        var svg = svgEl('svg', { class: 'tm-part__svg' });
        renderShape(svg, component);
        var caption = el('span', 'tm-part__label', component.label);
        var meta = el('span', 'tm-part__meta', component.declaredCategory || 'category not supplied');
        var description = el('span', 'tm-part__sr', component.description || 'No description supplied.');
        description.id = uid + '-desc-' + component.id;
        button.append(svg, caption, meta, description);
        button.addEventListener('click', function () { select(component.id); });
        grid.append(button);
      });
      updateButtonStates();
    }

    var api = {
      ASSET_ID: 'aut250-lab-asset-vehicle-components',
      mount: rootEl,
      setComponents: function (raw) {
        var issues = [];
        var components = [];
        DC.asArray(raw).forEach(function (entry) {
          var result = normalizeComponent(entry);
          if (!result.ok) {
            issues = issues.concat(result.issues);
            return;
          }
          issues = issues.concat(result.issues);
          components.push(result.component);
        });
        state.components = components;
        state.issues = issues;
        state.highlighted = {};
        if (!componentById(state.selectedId)) state.selectedId = null;
        renderGrid();
        renderDetail();
        issuesEl.textContent = issues.length ? issues.join(' ') : '';
        return { ok: components.length > 0, issues: issues, componentCount: components.length };
      },
      select: select,
      getSelected: function () { return componentById(state.selectedId); },
      setHighlight: function (id, on) {
        var component = componentById(id);
        if (!component) return { ok: false, reason: 'Unknown component: ' + String(id) };
        if (!component.highlightable) return { ok: false, reason: 'Component ' + id + ' is not highlightable.' };
        state.highlighted[id] = Boolean(on);
        updateButtonStates();
        return { ok: true };
      },
      isHighlighted: function (id) { return Boolean(state.highlighted[id]); },
      getState: function () {
        return {
          components: state.components.slice(),
          selectedId: state.selectedId,
          highlighted: Object.keys(state.highlighted).filter(function (key) { return state.highlighted[key]; }),
          issues: state.issues.slice()
        };
      },
      destroy: function () { rootEl.remove(); }
    };

    renderGrid();
    renderDetail();
    return api;
  }

  return {
    createComponentLibrary: createComponentLibrary,
    normalizeComponent: normalizeComponent,
    SUPPORTED_CATEGORIES: SUPPORTED_CATEGORIES
  };
});

