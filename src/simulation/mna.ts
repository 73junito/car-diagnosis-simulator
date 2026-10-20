/**
 * Modified Nodal Analysis for the electrical domain.
 *
 * Design commitments carried from Gate 1/2B:
 *
 *  - Unknowns are the non-reference node voltages plus one branch current per
 *    ideal voltage source.
 *  - The system is solved with row equilibration (scaling) and scaled partial
 *    pivoting, then validated by an explicit infinity-norm residual computed
 *    against the ORIGINAL matrix.
 *  - Failure stages are accurate: assembly, factorization, solve, validation.
 *    `residuals` is null wherever no valid solution was produced, and is never
 *    synthesised to satisfy a schema.
 *  - Connectivity is determined from the post-fault topology. A node group with
 *    no path to the reference has an indeterminate absolute potential; it is
 *    reported as such and never as zero.
 *  - A sourceless island carries exactly zero current and zero internal
 *    potential difference, which are proved results rather than assumptions.
 */

import type { FailureAxis, FailureStage } from '../../contracts/primitives';
import type { Netlist, NetlistElement } from './netlist';

export type MnaFailureCode =
  | 'MATRIX_ASSEMBLY_FAILED'
  | 'NO_REFERENCE_NODE'
  | 'SINGULAR_MATRIX'
  | 'UNDERDETERMINED_SYSTEM'
  | 'RESIDUAL_EXCEEDED'
  | 'NONFINITE_RESULT';

export interface Residuals {
  readonly infinityNorm: number;
  readonly iterations: number;
  readonly tolerance: number;
  readonly toleranceKind: 'relative' | 'absolute';
}

export interface MnaFailure {
  readonly ok: false;
  readonly code: MnaFailureCode;
  readonly axis: FailureAxis;
  readonly stage: FailureStage;
  readonly message: string;
  /** Null wherever no valid solution was produced. */
  readonly residuals: Residuals | null;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface MnaSuccess {
  readonly ok: true;
  /** Nodes with a determinate potential relative to the reference. */
  readonly referenceComponentNodes: readonly string[];
  /** Absolute potential relative to the reference node, in volts. */
  readonly nodeVoltageAbsolute: Readonly<Record<string, number>>;
  /** Nodes whose absolute potential is undefined (unreferenced islands). */
  readonly indeterminateNodes: readonly string[];
  /** Voltage relative to each island's own local reference, where determinate. */
  readonly islandRelativeVoltage: Readonly<Record<string, number>>;
  readonly islandLocalReference: Readonly<Record<string, string>>;
  /** Element current from `fromNode` through the element to `toNode`, in amperes. */
  readonly elementCurrent: Readonly<Record<string, number>>;
  readonly residuals: Residuals;
  readonly islandResiduals: Readonly<Record<string, Residuals | null>>;
  readonly sourceCount: number;
  readonly unknownCount: number;
}

export type MnaResult = MnaSuccess | MnaFailure;

/** Relative pivot magnitude below which a matrix is treated as singular. */
const PIVOT_RELATIVE_TOLERANCE = 1e-12;
/** Relative residual tolerance applied to the original system. */
const RESIDUAL_RELATIVE_TOLERANCE = 1e-9;

function mnaFailure(
  code: MnaFailureCode,
  stage: FailureStage,
  message: string,
  residuals: Residuals | null,
  detail: Readonly<Record<string, unknown>> = {}
): MnaFailure {
  return { ok: false, code, axis: 'numerical', stage, message, residuals, detail };
}

export interface Partition {
  /** Node ids in the component that contains the reference node. */
  readonly referenceComponentNodes: readonly string[];
  /** Node groups with no conductive path to the reference. */
  readonly islands: readonly (readonly string[])[];
}

/**
 * Partitions nodes by connectivity over all modelled elements. Purely
 * topological: it answers "is there a path", not "what is the voltage".
 */
export function partitionNodes(netlist: Netlist): Partition {
  const adjacency = new Map<string, Set<string>>();
  for (const node of netlist.nodes) adjacency.set(node.nodeId, new Set());
  for (const element of netlist.elements) {
    adjacency.get(element.fromNode)?.add(element.toNode);
    adjacency.get(element.toNode)?.add(element.fromNode);
  }

  const visited = new Set<string>();
  const referenceComponentNodes: string[] = [];
  const islands: string[][] = [];

  for (const node of [...netlist.nodes].map((entry) => entry.nodeId).sort()) {
    if (visited.has(node)) continue;
    const group: string[] = [];
    const queue: string[] = [node];
    visited.add(node);
    while (queue.length > 0) {
      const current = queue.pop() as string;
      group.push(current);
      for (const neighbour of adjacency.get(current) ?? []) {
        if (visited.has(neighbour)) continue;
        visited.add(neighbour);
        queue.push(neighbour);
      }
    }
    group.sort();
    if (group.includes(netlist.referenceNodeId)) referenceComponentNodes.push(...group);
    else islands.push(group);
  }

  return { referenceComponentNodes, islands };
}

interface LinearSuccess {
  readonly ok: true;
  readonly x: number[];
  readonly residuals: Residuals;
}

interface LinearFailure {
  readonly ok: false;
  readonly code: MnaFailureCode;
  readonly stage: FailureStage;
  readonly message: string;
  readonly residuals: Residuals | null;
  readonly detail: Readonly<Record<string, unknown>>;
}

function infinityNorm(values: readonly number[]): number {
  let max = 0;
  for (const value of values) {
    const magnitude = Math.abs(value);
    if (magnitude > max) max = magnitude;
  }
  return max;
}

/**
 * Solves a dense linear system with row equilibration and scaled partial
 * pivoting, then validates the result against the ORIGINAL matrix.
 *
 * Deterministic: identical inputs produce identical outputs bit for bit.
 */
export function solveLinearSystem(
  a: readonly (readonly number[])[],
  b: readonly number[]
): LinearSuccess | LinearFailure {
  const n = b.length;
  if (n === 0) {
    return {
      ok: true,
      x: [],
      residuals: { infinityNorm: 0, iterations: 0, tolerance: 0, toleranceKind: 'relative' }
    };
  }

  const matrix = a.map((row) => [...row]);
  const rhs = [...b];
  const scale = matrix.map((row) => infinityNorm(row));

  for (let i = 0; i < n; i += 1) {
    if ((scale[i] ?? 0) === 0) {
      return {
        ok: false,
        code: 'SINGULAR_MATRIX',
        stage: 'factorization',
        message: `matrix row ${i} is entirely zero, so the system has no unique solution`,
        residuals: null,
        detail: { row: i }
      };
    }
  }

  let iterations = 0;

  for (let k = 0; k < n; k += 1) {
    let pivotRow = -1;
    let bestRatio = -1;
    for (let i = k; i < n; i += 1) {
      const row = matrix[i];
      if (!row) continue;
      const magnitude = Math.abs(row[k] ?? 0);
      const ratio = magnitude / (scale[i] ?? 1);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        pivotRow = i;
      }
    }
    if (pivotRow < 0 || bestRatio <= PIVOT_RELATIVE_TOLERANCE) {
      return {
        ok: false,
        code: 'SINGULAR_MATRIX',
        stage: 'factorization',
        message: `no usable pivot in column ${k}: the system is singular or underdetermined`,
        residuals: null,
        detail: { column: k, bestRatio }
      };
    }

    if (pivotRow !== k) {
      const rowK = matrix[k] as number[];
      const rowP = matrix[pivotRow] as number[];
      matrix[k] = rowP;
      matrix[pivotRow] = rowK;
      const swapRhs = rhs[k] as number;
      rhs[k] = rhs[pivotRow] as number;
      rhs[pivotRow] = swapRhs;
      const swapScale = scale[k] as number;
      scale[k] = scale[pivotRow] as number;
      scale[pivotRow] = swapScale;
    }

    const pivot = matrix[k]?.[k] ?? 0;
    if (!Number.isFinite(pivot) || pivot === 0) {
      return {
        ok: false,
        code: 'NONFINITE_RESULT',
        stage: 'solve',
        message: `pivot at column ${k} is not a usable finite value`,
        residuals: null,
        detail: { column: k, pivot }
      };
    }

    const pivotRowValues = matrix[k] as number[];
    for (let i = k + 1; i < n; i += 1) {
      const row = matrix[i];
      if (!row) continue;
      const factor = (row[k] ?? 0) / pivot;
      if (factor === 0) continue;
      for (let j = k; j < n; j += 1) {
        row[j] = (row[j] ?? 0) - factor * (pivotRowValues[j] ?? 0);
      }
      rhs[i] = (rhs[i] ?? 0) - factor * (rhs[k] ?? 0);
      iterations += 1;
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = rhs[i] ?? 0;
    const row = matrix[i] as number[];
    for (let j = i + 1; j < n; j += 1) sum -= (row[j] ?? 0) * (x[j] ?? 0);
    const diagonal = row[i] ?? 0;
    if (diagonal === 0) {
      return {
        ok: false,
        code: 'SINGULAR_MATRIX',
        stage: 'factorization',
        message: `zero diagonal after elimination at row ${i}`,
        residuals: null,
        detail: { row: i }
      };
    }
    x[i] = sum / diagonal;
  }

  const nonFinite = x.findIndex((value) => !Number.isFinite(value));
  if (nonFinite >= 0) {
    return {
      ok: false,
      code: 'NONFINITE_RESULT',
      stage: 'validation',
      message: `solution component ${nonFinite} is not a finite number`,
      // A candidate vector exists but is not finite, so no meaningful residual
      // can be computed. Null is reported rather than a fabricated number.
      residuals: null,
      detail: { index: nonFinite, value: x[nonFinite] }
    };
  }

  const residualVector = a.map((row, index) => {
    let sum = 0;
    for (let j = 0; j < n; j += 1) sum += (row[j] ?? 0) * (x[j] ?? 0);
    return sum - (b[index] ?? 0);
  });
  const infinityResidual = infinityNorm(residualVector);
  const tolerance = Math.max(1e-9, RESIDUAL_RELATIVE_TOLERANCE * infinityNorm(b));
  const residuals: Residuals = {
    infinityNorm: infinityResidual,
    iterations,
    tolerance,
    toleranceKind: 'relative'
  };

  if (!(infinityResidual <= tolerance)) {
    return {
      ok: false,
      code: 'RESIDUAL_EXCEEDED',
      stage: 'validation',
      message: 'the computed solution does not satisfy the original system within tolerance',
      residuals,
      detail: { infinityNorm: infinityResidual, tolerance }
    };
  }

  return { ok: true, x, residuals };
}

interface ComponentSolveOptions {
  readonly nodes: readonly string[];
  readonly elements: readonly NetlistElement[];
  readonly localReference: string;
}

interface ComponentSolveValue {
  /** Node potential relative to the component's local reference. */
  readonly nodeVoltageRelative: Readonly<Record<string, number>>;
  /** Element current from `fromNode` through the element to `toNode`. */
  readonly elementCurrent: Readonly<Record<string, number>>;
  readonly residuals: Residuals;
  readonly sourceCount: number;
  readonly unknownCount: number;
}

/** Assembles and solves one connected component of the netlist. */
function solveComponent(
  options: ComponentSolveOptions
): { ok: true; value: ComponentSolveValue } | { ok: false; failure: MnaFailure } {
  const nodeIndex = new Map<string, number>();
  for (const node of options.nodes) {
    if (node === options.localReference) continue;
    nodeIndex.set(node, nodeIndex.size);
  }
  const sources = options.elements.filter((element) => element.kind === 'ideal-voltage-source');
  const nodeUnknowns = nodeIndex.size;
  const size = nodeUnknowns + sources.length;

  const nodeVoltageRelative: Record<string, number> = {};
  for (const node of options.nodes) nodeVoltageRelative[node] = 0;

  if (size === 0) {
    return {
      ok: true,
      value: {
        nodeVoltageRelative,
        elementCurrent: {},
        residuals: { infinityNorm: 0, iterations: 0, tolerance: 0, toleranceKind: 'relative' },
        sourceCount: 0,
        unknownCount: 0
      }
    };
  }

  const a: number[][] = [];
  for (let i = 0; i < size; i += 1) a.push(new Array<number>(size).fill(0));
  const b = new Array<number>(size).fill(0);
  const matrix = a as number[][];

  const indexOf = (node: string): number => nodeIndex.get(node) ?? -1;

  for (const element of options.elements) {
    if (element.kind === 'ideal-voltage-source') continue;
    const resistance = element.resistanceOhm;
    if (resistance === null || !(resistance > 0)) continue;
    const conductance = 1 / resistance;
    const from = indexOf(element.fromNode);
    const to = indexOf(element.toNode);
    if (from >= 0) {
      const row = matrix[from] as number[];
      row[from] = (row[from] ?? 0) + conductance;
    }
    if (to >= 0) {
      const row = matrix[to] as number[];
      row[to] = (row[to] ?? 0) + conductance;
    }
    if (from >= 0 && to >= 0) {
      const rowFrom = matrix[from] as number[];
      const rowTo = matrix[to] as number[];
      rowFrom[to] = (rowFrom[to] ?? 0) - conductance;
      rowTo[from] = (rowTo[from] ?? 0) - conductance;
    }
  }

  sources.forEach((element, sourceIndex) => {
    const column = nodeUnknowns + sourceIndex;
    const positiveNode = element.positiveNode ?? element.fromNode;
    const negativeNode = element.toNode;
    const positive = indexOf(positiveNode);
    const negative = indexOf(negativeNode);
    if (positive >= 0) {
      const row = matrix[positive] as number[];
      row[column] = (row[column] ?? 0) + 1;
      const sourceRow = matrix[column] as number[];
      sourceRow[positive] = (sourceRow[positive] ?? 0) + 1;
    }
    if (negative >= 0) {
      const row = matrix[negative] as number[];
      row[column] = (row[column] ?? 0) - 1;
      const sourceRow = matrix[column] as number[];
      sourceRow[negative] = (sourceRow[negative] ?? 0) - 1;
    }
    b[column] = element.sourceVoltageV ?? 0;
  });

  const linear = solveLinearSystem(a, b);
  if (!linear.ok) {
    return {
      ok: false,
      failure: mnaFailure(linear.code, linear.stage, linear.message, linear.residuals, linear.detail)
    };
  }

  const solution = linear.x;
  for (const [node, index] of nodeIndex) nodeVoltageRelative[node] = solution[index] ?? 0;

  const elementCurrent: Record<string, number> = {};
  for (const element of options.elements) {
    if (element.kind === 'ideal-voltage-source') continue;
    const resistance = element.resistanceOhm;
    if (resistance === null || !(resistance > 0)) continue;
    const fromVoltage = nodeVoltageRelative[element.fromNode] ?? 0;
    const toVoltage = nodeVoltageRelative[element.toNode] ?? 0;
    elementCurrent[element.elementId] = (fromVoltage - toVoltage) / resistance;
  }
  sources.forEach((element, sourceIndex) => {
    elementCurrent[element.elementId] = solution[nodeUnknowns + sourceIndex] ?? 0;
  });

  return {
    ok: true,
    value: {
      nodeVoltageRelative,
      elementCurrent,
      residuals: linear.residuals,
      sourceCount: sources.length,
      unknownCount: size
    }
  };
}

/**
 * Solves a translated netlist.
 *
 * The reference component yields absolute potentials. Unreferenced islands
 * yield determinate internal potential differences and currents, but their
 * absolute potential is undefined and is reported as indeterminate — never as
 * zero.
 */
export function solveMna(netlist: Netlist): MnaResult {
  if (netlist.nodes.length === 0) {
    return mnaFailure('MATRIX_ASSEMBLY_FAILED', 'assembly', 'netlist declares no nodes', null, {});
  }
  if (!netlist.nodes.some((node) => node.nodeId === netlist.referenceNodeId)) {
    return mnaFailure('NO_REFERENCE_NODE', 'assembly', 'reference node is not present in the netlist', null, {
      referenceNodeId: netlist.referenceNodeId
    });
  }

  const partition = partitionNodes(netlist);
  const referenceSet = new Set(partition.referenceComponentNodes);
  const referenceElements = netlist.elements.filter((element) => referenceSet.has(element.fromNode));

  const referenceSolve = solveComponent({
    nodes: partition.referenceComponentNodes,
    elements: referenceElements,
    localReference: netlist.referenceNodeId
  });
  if (!referenceSolve.ok) return referenceSolve.failure;

  const nodeVoltageAbsolute: Record<string, number> = {};
  for (const node of partition.referenceComponentNodes) {
    nodeVoltageAbsolute[node] = referenceSolve.value.nodeVoltageRelative[node] ?? 0;
  }

  const elementCurrent: Record<string, number> = { ...referenceSolve.value.elementCurrent };
  const islandRelativeVoltage: Record<string, number> = {};
  const islandLocalReference: Record<string, string> = {};
  const islandResiduals: Record<string, Residuals | null> = {};
  const indeterminateNodes: string[] = [];

  for (const island of partition.islands) {
    const islandSet = new Set(island);
    const islandElements = netlist.elements.filter((element) => islandSet.has(element.fromNode));
    const localReference = island[0] ?? '';
    const hasSource = islandElements.some((element) => element.kind === 'ideal-voltage-source');

    for (const node of island) {
      indeterminateNodes.push(node);
      islandLocalReference[node] = localReference;
    }

    if (hasSource) {
      const islandSolve = solveComponent({ nodes: island, elements: islandElements, localReference });
      if (!islandSolve.ok) return islandSolve.failure;
      for (const node of island) {
        islandRelativeVoltage[node] = islandSolve.value.nodeVoltageRelative[node] ?? 0;
      }
      Object.assign(elementCurrent, islandSolve.value.elementCurrent);
      islandResiduals[localReference] = islandSolve.value.residuals;
    } else {
      // Sourceless island: Kirchhoff's current law and the absence of any
      // electromotive force make every current exactly zero and every internal
      // potential difference exactly zero. These are proved results.
      for (const node of island) islandRelativeVoltage[node] = 0;
      for (const element of islandElements) elementCurrent[element.elementId] = 0;
      islandResiduals[localReference] = null;
    }
  }

  return {
    ok: true,
    referenceComponentNodes: partition.referenceComponentNodes,
    nodeVoltageAbsolute,
    indeterminateNodes,
    islandRelativeVoltage,
    islandLocalReference,
    elementCurrent,
    residuals: referenceSolve.value.residuals,
    islandResiduals,
    sourceCount: referenceSolve.value.sourceCount,
    unknownCount: referenceSolve.value.unknownCount
  };
}
