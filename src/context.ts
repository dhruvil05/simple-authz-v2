import { ContextError } from './errors.js'

// ─── Evaluation context ──────────────────────────────────────────────────────

/**
 * The frozen, sanitised object passed to the condition evaluator.
 * All values are deeply cloned from caller inputs and frozen.
 * Prototype-polluted keys are rejected before freezing.
 */
export interface EvalContext {
  readonly user: Readonly<Record<string, unknown>>
  readonly resource: Readonly<Record<string, unknown>>
  readonly ctx: Readonly<Record<string, unknown>>
}

// ─── Context builder ─────────────────────────────────────────────────────────
// Phase 4 implementation target.
// Deep-clones and Object.freeze()s all inputs before handing to the evaluator.
// Rejects objects containing __proto__, constructor, or prototype keys.
// Enforces a maximum nesting depth (default: 10) against DoS attacks.
// ─────────────────────────────────────────────────────────────────────────────

export function buildContext(
  user: unknown,
  resource: unknown,
  ctx: unknown,
  maxDepth: number,
): EvalContext {
  void user
  void resource
  void ctx
  void maxDepth
  throw new ContextError('buildContext not yet implemented (Phase 4)')
}

export function _sanitise(
  _value: unknown,
  _depth: number,
  _maxDepth: number,
  _path: string,
): unknown {
  throw new ContextError('_sanitise not yet implemented (Phase 4)')
}

export function _containsDangerousKey(_obj: unknown): boolean {
  throw new ContextError('_containsDangerousKey not yet implemented (Phase 4)')
}
