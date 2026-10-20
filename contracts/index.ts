/**
 * AutoLearnPro shared engineering and diagnostic contracts.
 *
 * Single entry point for the coordinated multi-domain model set. These are
 * type-level declarations plus a small number of pure helpers. No numerical
 * engine is implemented here.
 *
 * Authority boundary: nothing in this module may express a correct answer, a
 * score, assessment eligibility, publication approval, or a diagnostic
 * conclusion. The canonical lab registry remains data/lmf/lab-registry.json.
 */

export * from './primitives';
export * from './quantity';
export * from './vehicle';
export * from './model';
export * from './engine';
export * from './measurement';
export * from './modes';
