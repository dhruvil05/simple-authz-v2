import type { ConditionExpr, BinaryExpr, ComparisonOperator } from './types/ast.js'
import type { EvalContext } from './context.js'
import { EvaluationError } from './errors.js'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Walks a pre-compiled ConditionExpr AST and returns a boolean.
 * Zero eval(). Zero new Function(). Pure AST tree-walk.
 * Short-circuits: AND stops on first false, OR stops on first true.
 * Unknown paths resolve to undefined — never throw.
 */
export function evaluate(condition: ConditionExpr, context: EvalContext): boolean {
  switch (condition.kind) {
    case 'LiteralExpr':
      return Boolean(condition.value)

    case 'PathExpr':
      return Boolean(resolvePath(condition.segments, context))

    case 'UnaryExpr':
      return !evaluate(condition.operand, context)

    case 'BinaryExpr': {
      const expr = condition as BinaryExpr
      if (expr.operator === 'AND') {
        // Short-circuit: if left is false, skip right
        return evaluate(expr.left, context) && evaluate(expr.right, context)
      }
      if (expr.operator === 'OR') {
        // Short-circuit: if left is true, skip right
        return evaluate(expr.left, context) || evaluate(expr.right, context)
      }
      // Comparison operator
      const left = resolveValue(expr.left, context)
      const right = resolveValue(expr.right, context)
      return compare(left, expr.operator as ComparisonOperator, right)
    }

    default: {
      // Exhaustiveness guard
      throw new EvaluationError(`unknown AST node kind "${(condition as Record<string, unknown>)['kind'] as string}"`)
    }
  }
}

// ─── Value resolution ─────────────────────────────────────────────────────────

/**
 * Resolves a condition expression to its raw JS value (not coerced to boolean).
 * Used when we need the actual value for comparison operators.
 */
function resolveValue(expr: ConditionExpr, context: EvalContext): unknown {
  if (expr.kind === 'LiteralExpr') return expr.value
  if (expr.kind === 'PathExpr') return resolvePath(expr.segments, context)
  // For sub-expressions (AND/OR/NOT/comparison) used as values — evaluate to boolean
  return evaluate(expr, context)
}

// ─── Path resolution ──────────────────────────────────────────────────────────

/**
 * Resolves a dot-notation path against the frozen EvalContext.
 * Returns undefined for any missing segment — never throws.
 * First segment must be "user", "resource", or "ctx".
 */
export function resolvePath(
  segments: readonly string[],
  context: EvalContext,
): unknown {
  if (segments.length === 0) return undefined

  const [root, ...rest] = segments

  let current: unknown
  switch (root) {
    case 'user':     current = context.user;     break
    case 'resource': current = context.resource; break
    case 'ctx':      current = context.ctx;      break
    default:         return undefined
  }

  for (const segment of rest) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

// ─── Comparison ───────────────────────────────────────────────────────────────

/**
 * Strict comparison — no JS type coercion.
 * === for ==, !== for !=.
 * >, >=, <, <= return false if either operand is not a number or string.
 */
export function compare(
  left: unknown,
  operator: ComparisonOperator,
  right: unknown,
): boolean {
  switch (operator) {
    case '==': return left === right
    case '!=': return left !== right
    case '>':  return isOrderable(left, right) ? (left as number) >  (right as number) : false
    case '>=': return isOrderable(left, right) ? (left as number) >= (right as number) : false
    case '<':  return isOrderable(left, right) ? (left as number) <  (right as number) : false
    case '<=': return isOrderable(left, right) ? (left as number) <= (right as number) : false
    default: {
      const bad = operator as string
      throw new EvaluationError(`unknown comparison operator "${bad}"`)
    }
  }
}

function isOrderable(left: unknown, right: unknown): boolean {
  return (typeof left === 'number' && typeof right === 'number') ||
         (typeof left === 'string' && typeof right === 'string')
}

// ─── Exported alias for tests ─────────────────────────────────────────────────

export { resolvePath as _resolvePath, compare as _compare }
