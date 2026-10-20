/**
 * Electrical solver internal representation and template translation.
 *
 * Translation rules established in Gate 1/2B and implemented here:
 *
 *  - An ideal conductor (no declared conductor resistance) MERGES its two
 *    terminals into a single node.
 *  - A conductor with a declared resistance becomes a resistive branch, so its
 *    endpoints remain distinct nodes and a voltage drop can be measured across it.
 *  - A connection whose behaviour belongs to another domain adapter (network,
 *    signal, shield) is EXCLUDED from the DC solve. Excluded elements are
 *    reported with their physical continuity, so an excluded CAN conductor is
 *    never described as physically non-conductive.
 *  - A battery contributes two elements: an ideal voltage source and a series
 *    internal resistance, with a synthetic internal node between them.
 *  - Opening a branch removes it. Opening an ideal conductor SPLITS the node it
 *    merged, which is handled here rather than left to the caller.
 */

import type { DomainId, QuantityType } from '../../contracts/primitives';

export type ElementKind =
  | 'ideal-voltage-source'
  | 'resistor'
  | 'fuse'
  | 'switch'
  | 'relay-contact'
  | 'solenoid-coil'
  | 'motor-armature'
  | 'conductor';

export type NodeRole = 'reference' | 'terminal-derived' | 'battery-internal';

export interface NetlistNode {
  readonly nodeId: string;
  readonly role: NodeRole;
  /** Template terminal ids merged into this node, in deterministic order. */
  readonly terminals: readonly string[];
}

export interface NetlistElement {
  readonly elementId: string;
  readonly kind: ElementKind;
  readonly fromNode: string;
  readonly toNode: string;
  /** Template component id or connection id this element came from. */
  readonly templateOrigin: string;
  readonly parameterId: string | null;
  /** Resistance in ohms for resistive kinds; null for the ideal source. */
  readonly resistanceOhm: number | null;
  /** Source voltage in volts; null for resistive kinds. */
  readonly sourceVoltageV: number | null;
  readonly positiveNode: string | null;
  readonly voltageSystemId: string;
}

export interface ExcludedElement {
  readonly elementId: string;
  readonly templateOrigin: string;
  /** Physical fact about the harness. Never `none` for a real conductor. */
  readonly physicalContinuity: 'galvanic' | 'coupled' | 'none';
  readonly dcModelApplicability: 'modelled' | 'excluded-by-domain' | 'unsupported';
  readonly requiredDomainAdapter: DomainId | null;
  readonly exclusionReason: string;
}

export interface Netlist {
  readonly modelRef: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly referenceNodeId: string;
  readonly nodes: readonly NetlistNode[];
  readonly elements: readonly NetlistElement[];
  readonly excludedElements: readonly ExcludedElement[];
  readonly warnings: readonly string[];
  /** Terminal id to node id. */
  readonly terminalToNode: Readonly<Record<string, string>>;
  /** Test-point id to node id, so a lab can probe by test point. */
  readonly testPointToNode: Readonly<Record<string, string>>;
}

export type TranslationFailureCode =
  | 'NO_REFERENCE_NODE'
  | 'MULTIPLE_REFERENCE_NODES'
  | 'TOPOLOGY_UNSUPPORTED'
  | 'CROSS_DOMAIN_PATH'
  | 'MISSING_PARAMETER'
  | 'INVALID_TEMPLATE';

export interface TranslationFailure {
  readonly ok: false;
  readonly code: TranslationFailureCode;
  readonly message: string;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface TranslationSuccess {
  readonly ok: true;
  readonly netlist: Netlist;
}

export type TranslationResult = TranslationSuccess | TranslationFailure;

/** Connection types that carry direct current in this domain. */
const DC_CONDUCTIVE_TYPES = new Set(['power_feed', 'ground_reference', 'control', 'hardwire']);

/** Connection types owned by the network-control adapter. */
const NETWORK_TYPES = new Set(['CAN', 'LIN']);

/** Connection types owned by a signal-aware adapter. */
const SIGNAL_TYPES = new Set(['analog_signal', 'digital_signal']);

const RESISTIVE_KIND_BY_COMPONENT_TYPE: Record<string, { kind: ElementKind; parameterId: string }> = {
  fuse: { kind: 'fuse', parameterId: 'closedResistance' },
  fusible_link: { kind: 'fuse', parameterId: 'closedResistance' },
  switch: { kind: 'switch', parameterId: 'closedResistance' },
  relay: { kind: 'relay-contact', parameterId: 'closedResistance' },
  actuator: { kind: 'solenoid-coil', parameterId: 'coilResistance' },
  motor: { kind: 'motor-armature', parameterId: 'armatureResistance' },
  load: { kind: 'resistor', parameterId: 'resistance' },
  lamp: { kind: 'resistor', parameterId: 'resistance' },
  resistor: { kind: 'resistor', parameterId: 'resistance' }
};

interface RawConnection {
  id: string;
  from: string;
  to: string;
  type: string;
  voltageSystemId?: string;
  pwmModel?: unknown;
}

interface RawComponent {
  id: string;
  type: string;
  voltageSystemId?: string;
  terminals: { id: string }[];
  internalConnections?: string[][];
}

interface RawTemplate {
  templateId: string;
  templateVersion: string;
  components: RawComponent[];
  connections: RawConnection[];
  elementParameters: {
    elementId: string;
    parameterId: string;
    value: number;
  }[];
  conductorResistances: { connectionId: string; resistanceOhm: number }[];
  elementStates?: {
    stateId: string;
    independentlyActuatedElements: { elementId: string; actuation: 'closed' | 'open' }[];
  }[];
}

export interface TranslationOptions {
  readonly modelRef: string;
  readonly operatingStateId: string;
  /** Element ids removed by a fault. */
  readonly removedElementIds?: readonly string[];
  /** Element ids forced open regardless of declared state. */
  readonly forcedOpenElementIds?: readonly string[];
  /** Element ids forced closed regardless of declared state. */
  readonly forcedClosedElementIds?: readonly string[];
}

/** Union-find over terminals, used for ideal-conductor node merging. */
class UnionFind {
  private readonly parent = new Map<string, string>();

  add(item: string): void {
    if (!this.parent.has(item)) this.parent.set(item, item);
  }

  find(item: string): string {
    this.add(item);
    let root = item;
    for (;;) {
      const next = this.parent.get(root);
      if (next === undefined || next === root) break;
      root = next;
    }
    let cursor = item;
    for (;;) {
      const next = this.parent.get(cursor);
      if (next === undefined || next === root) break;
      this.parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}

function fail(
  code: TranslationFailureCode,
  message: string,
  detail: Readonly<Record<string, unknown>> = {}
): TranslationFailure {
  return { ok: false, code, message, detail };
}

/**
 * Translates a circuit template into a validated electrical netlist.
 *
 * Deterministic: the same template, operating state, and fault set always
 * produce the same nodes, elements, and ordering.
 */
export function translateTemplate(template: unknown, options: TranslationOptions): TranslationResult {
  const raw = template as Partial<RawTemplate> | null;
  if (!raw || typeof raw !== 'object') return fail('INVALID_TEMPLATE', 'template must be an object');
  const components = raw.components;
  const connections = raw.connections;
  if (!Array.isArray(components) || !Array.isArray(connections)) {
    return fail('INVALID_TEMPLATE', 'template must declare components and connections arrays');
  }

  const groundComponents = components.filter((component) => component.type === 'ground');
  if (groundComponents.length === 0) {
    return fail('NO_REFERENCE_NODE', 'template declares no ground component');
  }
  if (groundComponents.length > 1) {
    return fail('MULTIPLE_REFERENCE_NODES', 'template declares more than one ground component', {
      count: groundComponents.length
    });
  }
  const referenceTerminal = groundComponents[0]?.terminals?.[0]?.id;
  if (!referenceTerminal) return fail('NO_REFERENCE_NODE', 'ground component declares no terminal');

  const removed = new Set(options.removedElementIds ?? []);
  const forcedOpen = new Set(options.forcedOpenElementIds ?? []);
  const forcedClosed = new Set(options.forcedClosedElementIds ?? []);

  const parameterIndex = new Map<string, number>();
  for (const parameter of raw.elementParameters ?? []) {
    parameterIndex.set(`${parameter.elementId}.${parameter.parameterId}`, parameter.value);
  }
  const conductorIndex = new Map<string, number>();
  for (const conductor of raw.conductorResistances ?? []) {
    conductorIndex.set(conductor.connectionId, conductor.resistanceOhm);
  }
  const stateIndex = new Map<string, 'closed' | 'open'>();
  for (const state of raw.elementStates ?? []) {
    if (state.stateId !== options.operatingStateId) continue;
    for (const entry of state.independentlyActuatedElements) {
      stateIndex.set(entry.elementId, entry.actuation);
    }
  }

  const unionFind = new UnionFind();
  for (const component of components) {
    for (const terminal of component.terminals ?? []) if (terminal.id) unionFind.add(terminal.id);
  }

  const excludedElements: ExcludedElement[] = [];
  const warnings: string[] = [];
  const voltageSystemIds = new Set<string>();

  for (const connection of connections) {
    // Removing an ideal conductor simply omits the merge, which splits the node.
    if (removed.has(connection.id)) continue;

    const isNetwork = NETWORK_TYPES.has(connection.type);
    const isSignal = SIGNAL_TYPES.has(connection.type);
    const isPwmWithoutModel = connection.type === 'PWM' && connection.pwmModel === undefined;

    if (isNetwork || isSignal || isPwmWithoutModel) {
      excludedElements.push({
        elementId: `EXCLUDED:${connection.id}`,
        templateOrigin: connection.id,
        physicalContinuity: 'galvanic',
        dcModelApplicability: isPwmWithoutModel ? 'unsupported' : 'excluded-by-domain',
        requiredDomainAdapter: isNetwork ? 'network-control' : isSignal ? 'electrical' : null,
        exclusionReason: isNetwork
          ? 'Network conductor: physically galvanic, but bus behaviour belongs to the network-control adapter.'
          : isSignal
            ? 'Signal conductor: physically galvanic, but signal behaviour requires a signal-aware adapter.'
            : 'PWM conductor: excluded until an equivalent-circuit model is declared.'
      });
      continue;
    }
    if (!DC_CONDUCTIVE_TYPES.has(connection.type)) {
      excludedElements.push({
        elementId: `EXCLUDED:${connection.id}`,
        templateOrigin: connection.id,
        physicalContinuity: 'galvanic',
        dcModelApplicability: 'unsupported',
        requiredDomainAdapter: null,
        exclusionReason: `Connection type ${connection.type} has no validated DC model.`
      });
      continue;
    }

    if (connection.voltageSystemId) voltageSystemIds.add(connection.voltageSystemId);
    if (conductorIndex.get(connection.id) === undefined) {
      unionFind.union(connection.from, connection.to);
    }
  }

  if (voltageSystemIds.size > 1) {
    return fail(
      'CROSS_DOMAIN_PATH',
      'DC-conductive paths span more than one voltage system without a modelled converter',
      { voltageSystemIds: [...voltageSystemIds].sort() }
    );
  }
  const voltageSystemId = [...voltageSystemIds][0] ?? 'LV12';
  void warnings;

  // --- component elements ---------------------------------------------------------
  const elements: NetlistElement[] = [];
  const batteryInternalNodes = new Map<string, string>();

  for (const component of components) {
    if (removed.has(component.id)) continue;
    if (component.type === 'ground') continue;

    if (component.type === 'battery') {
      const sourceVoltage = parameterIndex.get(`${component.id}.sourceVoltage`);
      const internalResistance = parameterIndex.get(`${component.id}.internalResistance`);
      if (sourceVoltage === undefined) {
        return fail('MISSING_PARAMETER', `battery ${component.id} requires sourceVoltage`, {
          componentId: component.id
        });
      }
      if (internalResistance === undefined) {
        return fail('MISSING_PARAMETER', `battery ${component.id} requires internalResistance`, {
          componentId: component.id
        });
      }
      const terminals = component.terminals ?? [];
      const posTerminal =
        terminals.find((terminal) => /POS/i.test(terminal.id))?.id ?? terminals[0]?.id;
      const negTerminal =
        terminals.find((terminal) => /NEG/i.test(terminal.id))?.id ?? terminals[1]?.id;
      if (!posTerminal || !negTerminal) {
        return fail('INVALID_TEMPLATE', `battery ${component.id} requires two terminals`, {
          componentId: component.id
        });
      }
      const internalNode = `net:${component.id}:internal`;
      batteryInternalNodes.set(component.id, internalNode);
      unionFind.add(internalNode);
      elements.push({
        elementId: `E:${component.id}:sourceVoltage`,
        kind: 'ideal-voltage-source',
        fromNode: internalNode,
        toNode: negTerminal,
        templateOrigin: component.id,
        parameterId: 'sourceVoltage',
        resistanceOhm: null,
        sourceVoltageV: sourceVoltage,
        positiveNode: internalNode,
        voltageSystemId: component.voltageSystemId ?? voltageSystemId
      });
      elements.push({
        elementId: `E:${component.id}:internalResistance`,
        kind: 'resistor',
        fromNode: posTerminal,
        toNode: internalNode,
        templateOrigin: component.id,
        parameterId: 'internalResistance',
        resistanceOhm: internalResistance,
        sourceVoltageV: null,
        positiveNode: null,
        voltageSystemId: component.voltageSystemId ?? voltageSystemId
      });
      continue;
    }

    const mapping = RESISTIVE_KIND_BY_COMPONENT_TYPE[component.type];
    const internalConnections = component.internalConnections ?? [];
    if (!mapping || internalConnections.length === 0) continue;

    const declaredState = stateIndex.get(component.id);
    const isOpen =
      forcedOpen.has(component.id) ||
      (!forcedClosed.has(component.id) && declaredState === 'open');
    // An open element contributes no branch: the branch is removed.
    if (isOpen) continue;

    const value = parameterIndex.get(`${component.id}.${mapping.parameterId}`);
    if (value === undefined) {
      return fail('MISSING_PARAMETER', `${component.type} ${component.id} requires ${mapping.parameterId}`, {
        componentId: component.id,
        parameterId: mapping.parameterId
      });
    }
    if (!(value > 0)) {
      return fail('INVALID_TEMPLATE', `${component.id}.${mapping.parameterId} must be greater than zero`, {
        componentId: component.id
      });
    }

    for (const pair of internalConnections) {
      const from = pair[0];
      const to = pair[1];
      if (!from || !to) {
        return fail('INVALID_TEMPLATE', `${component.id} has an incomplete internal connection`, {
          componentId: component.id
        });
      }
      elements.push({
        elementId: `E:${component.id}:${mapping.parameterId}`,
        kind: mapping.kind,
        fromNode: from,
        toNode: to,
        templateOrigin: component.id,
        parameterId: mapping.parameterId,
        resistanceOhm: value,
        sourceVoltageV: null,
        positiveNode: null,
        voltageSystemId: component.voltageSystemId ?? voltageSystemId
      });
    }
  }

  // --- resistive conductors become branches ---------------------------------------
  for (const connection of connections) {
    if (removed.has(connection.id)) continue;
    if (!DC_CONDUCTIVE_TYPES.has(connection.type)) continue;
    const declared = conductorIndex.get(connection.id);
    if (declared === undefined) continue;
    if (!(declared > 0)) {
      return fail('INVALID_TEMPLATE', `conductor ${connection.id} resistance must be greater than zero`, {
        connectionId: connection.id
      });
    }
    elements.push({
      elementId: `E:${connection.id}:conductor`,
      kind: 'conductor',
      fromNode: connection.from,
      toNode: connection.to,
      templateOrigin: connection.id,
      parameterId: null,
      resistanceOhm: declared,
      sourceVoltageV: null,
      positiveNode: null,
      voltageSystemId: connection.voltageSystemId ?? voltageSystemId
    });
  }

  // --- node assignment -------------------------------------------------------------
  const terminalsByRoot = new Map<string, string[]>();
  const internalRoots = new Set<string>();
  for (const component of components) {
    for (const terminal of component.terminals ?? []) {
      if (!terminal.id) continue;
      const root = unionFind.find(terminal.id);
      const list = terminalsByRoot.get(root);
      if (list) list.push(terminal.id);
      else terminalsByRoot.set(root, [terminal.id]);
    }
  }
  for (const internalNode of batteryInternalNodes.values()) {
    const root = unionFind.find(internalNode);
    terminalsByRoot.set(root, [internalNode]);
    internalRoots.add(root);
  }

  const referenceRoot = unionFind.find(referenceTerminal);
  const nodes: NetlistNode[] = [];
  const nodeIdByTerminal = new Map<string, string>();
  let referenceNodeId = 'N_REF';

  for (const [root, terminals] of terminalsByRoot) {
    const sorted = [...terminals].sort();
    const isInternal = internalRoots.has(root);
    const isReference = root === referenceRoot;
    const canonical = sorted[0] ?? root;
    const nodeId = isReference ? 'N_REF' : isInternal ? canonical : `net:${canonical}`;
    const role: NodeRole = isReference
      ? 'reference'
      : isInternal
        ? 'battery-internal'
        : 'terminal-derived';
    if (isReference) referenceNodeId = nodeId;
    nodes.push({ nodeId, role, terminals: isInternal ? [] : sorted });
    for (const terminal of sorted) nodeIdByTerminal.set(terminal, nodeId);
  }
  nodes.sort((a, b) => (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0));

  const resolvedElements: NetlistElement[] = [];
  for (const element of elements) {
    const from = nodeIdByTerminal.get(element.fromNode);
    const to = nodeIdByTerminal.get(element.toNode);
    if (!from || !to) {
      return fail('INVALID_TEMPLATE', `element ${element.elementId} references an unknown terminal`, {
        elementId: element.elementId,
        fromNode: element.fromNode,
        toNode: element.toNode
      });
    }
    const positive =
      element.positiveNode === null ? null : nodeIdByTerminal.get(element.positiveNode) ?? null;
    resolvedElements.push({ ...element, fromNode: from, toNode: to, positiveNode: positive });
  }
  resolvedElements.sort((a, b) =>
    a.elementId < b.elementId ? -1 : a.elementId > b.elementId ? 1 : 0
  );

  const testPointToNode: Record<string, string> = {};
  for (const testPoint of (raw as { testPoints?: { id: string; terminalId: string }[] }).testPoints ?? []) {
    const node = nodeIdByTerminal.get(testPoint.terminalId);
    if (node) testPointToNode[testPoint.id] = node;
  }

  return {
    ok: true,
    netlist: {
      modelRef: options.modelRef,
      templateId: raw.templateId ?? '',
      templateVersion: raw.templateVersion ?? '',
      referenceNodeId,
      nodes,
      elements: resolvedElements,
      excludedElements,
      warnings,
      terminalToNode: Object.fromEntries(nodeIdByTerminal),
      testPointToNode
    }
  };
}
