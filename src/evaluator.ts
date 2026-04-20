import type { ConditionExpr } from './types/ast.js'
import type { EvalContext } from './context.js'
import { EvaluationError } from './errors.js'

// ─── Evaluator ───────────────────────────────────────────────────────────────
// Phase 4 implementation target.
// Walks a pre-compiled ConditionExpr AST against a frozen EvalContext.
// Zero use of eval() or new Function() — tree-walk only.
// Strict equality: no JS loose coercion (=== not ==).
// Unknown path segments resolve to undefined — never throw.
// Short-circuits: AND stops on first false, OR stops on first true.
// ─────────────────────────────────────────────────────────────────────────────

export function evaluate(
  condition: ConditionExpr,
  context: EvalContext,
): boolean {
  void condition
  void context
  throw new EvaluationError('evaluate not yet implemented (Phase 4)')
}

export function _resolvePath(
  _segments: readonly string[],
  _context: EvalContext,
): unknown {
  throw new EvaluationError('_resolvePath not yet implemented (Phase 4)')
}

export function _compare(
  _left: unknown,
  _operator: string,
  _right: unknown,
): boolean {
  throw new EvaluationError('_compare not yet implemented (Phase 4)')
}
