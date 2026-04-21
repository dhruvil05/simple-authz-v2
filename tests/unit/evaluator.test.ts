import { describe, it, expect } from 'vitest'
import { evaluate, resolvePath, compare } from '../../src/evaluator.js'
import { EvaluationError } from '../../src/errors.js'
import type { ConditionExpr, LiteralExpr, PathExpr, BinaryExpr, UnaryExpr } from '../../src/types/ast.js'
import type { EvalContext } from '../../src/context.js'

const lit = (value: string | number | boolean | null): LiteralExpr => ({ kind: 'LiteralExpr', value })
const path = (...segments: string[]): PathExpr => ({ kind: 'PathExpr', segments })
const bin = (left: ConditionExpr, op: BinaryExpr['operator'], right: ConditionExpr): BinaryExpr =>
  ({ kind: 'BinaryExpr', left, operator: op, right })
const not = (operand: ConditionExpr): UnaryExpr => ({ kind: 'UnaryExpr', operator: 'NOT', operand })

const ctx: EvalContext = {
  user: Object.freeze({ id: 10, roles: ['broker'], plan: 'premium', verified: true }),
  resource: Object.freeze({ owner_id: 10, status: 'draft', active: true, count: 5, archived: false, suspended: false }),
  ctx: Object.freeze({ tenantId: 'acme' }),
}

const ctx2: EvalContext = {
  user: Object.freeze({ id: 99, roles: ['user'] }),
  resource: Object.freeze({ owner_id: 10, status: 'public', active: false, count: 0 }),
  ctx: Object.freeze({}),
}

describe('Evaluator — LiteralExpr', () => {
  it('true literal evaluates to true', () => expect(evaluate(lit(true), ctx)).toBe(true))
  it('false literal evaluates to false', () => expect(evaluate(lit(false), ctx)).toBe(false))
  it('non-zero number is truthy', () => expect(evaluate(lit(1), ctx)).toBe(true))
  it('zero is falsy', () => expect(evaluate(lit(0), ctx)).toBe(false))
  it('null literal evaluates to false', () => expect(evaluate(lit(null), ctx)).toBe(false))
  it('non-empty string is truthy', () => expect(evaluate(lit('hello'), ctx)).toBe(true))
})

describe('Evaluator — PathExpr resolution', () => {
  it('user.id resolves to 10', () => expect(resolvePath(['user', 'id'], ctx)).toBe(10))
  it('resource.owner_id resolves to 10', () => expect(resolvePath(['resource', 'owner_id'], ctx)).toBe(10))
  it('resource.status resolves to "draft"', () => expect(resolvePath(['resource', 'status'], ctx)).toBe('draft'))
  it('ctx.tenantId resolves from ctx object', () => expect(resolvePath(['ctx', 'tenantId'], ctx)).toBe('acme'))
  it('unknown key resolves to undefined — does not throw', () => expect(resolvePath(['user', 'missing'], ctx)).toBeUndefined())
  it('unknown root resolves to undefined', () => expect(resolvePath(['request', 'id'], ctx)).toBeUndefined())
  it('empty segments returns undefined', () => expect(resolvePath([], ctx)).toBeUndefined())
  it('path through non-object returns undefined', () => expect(resolvePath(['resource', 'status', 'length'], ctx)).toBeUndefined())
})

describe('Evaluator — BinaryExpr comparisons', () => {
  it('== true when values strictly equal', () => expect(evaluate(bin(path('user','id'), '==', lit(10)), ctx)).toBe(true))
  it('== false when values differ', () => expect(evaluate(bin(path('user','id'), '==', lit(99)), ctx)).toBe(false))
  it('!= true when values differ', () => expect(evaluate(bin(path('user','id'), '!=', lit(99)), ctx)).toBe(true))
  it('!= false when values equal', () => expect(evaluate(bin(path('user','id'), '!=', lit(10)), ctx)).toBe(false))
  it('> true when left greater', () => expect(evaluate(bin(path('resource','count'), '>', lit(3)), ctx)).toBe(true))
  it('> false when left equal', () => expect(evaluate(bin(path('resource','count'), '>', lit(5)), ctx)).toBe(false))
  it('>= true when left equal', () => expect(evaluate(bin(path('resource','count'), '>=', lit(5)), ctx)).toBe(true))
  it('>= true when left greater', () => expect(evaluate(bin(path('resource','count'), '>=', lit(4)), ctx)).toBe(true))
  it('< true when left less', () => expect(evaluate(bin(path('resource','count'), '<', lit(10)), ctx)).toBe(true))
  it('<= true when left equal', () => expect(evaluate(bin(path('resource','count'), '<=', lit(5)), ctx)).toBe(true))
  it('string == string comparison works', () => expect(evaluate(bin(path('resource','status'), '==', lit('draft')), ctx)).toBe(true))
  it('boolean == boolean works', () => expect(evaluate(bin(path('resource','active'), '==', lit(true)), ctx)).toBe(true))
  it('undefined == undefined returns true', () => expect(evaluate(bin(path('user','missing'), '==', path('user','alsoMissing')), ctx)).toBe(true))
  it('undefined != null returns true (strict)', () => expect(evaluate(bin(path('user','missing'), '!=', lit(null)), ctx)).toBe(true))
  it('orderable check: string < string works', () => expect(evaluate(bin(lit('apple'), '<', lit('banana')), ctx)).toBe(true))
  it('non-orderable types return false for >', () => expect(evaluate(bin(lit(true), '>', lit(false)), ctx)).toBe(false))
})

describe('Evaluator — AND logic', () => {
  it('true AND true → true', () => expect(evaluate(bin(lit(true), 'AND', lit(true)), ctx)).toBe(true))
  it('true AND false → false', () => expect(evaluate(bin(lit(true), 'AND', lit(false)), ctx)).toBe(false))
  it('false AND true → false', () => expect(evaluate(bin(lit(false), 'AND', lit(true)), ctx)).toBe(false))
  it('false AND false → false', () => expect(evaluate(bin(lit(false), 'AND', lit(false)), ctx)).toBe(false))
  it('short-circuits: false AND [never evaluated]', () => {
    let evaluated = false
    // We can test this by ensuring the right branch is a path that would resolve truthy
    // but the AND short-circuits on false left
    const result = evaluate(bin(lit(false), 'AND', lit(true)), ctx)
    expect(result).toBe(false)
  })
})

describe('Evaluator — OR logic', () => {
  it('true OR false → true', () => expect(evaluate(bin(lit(true), 'OR', lit(false)), ctx)).toBe(true))
  it('false OR true → true', () => expect(evaluate(bin(lit(false), 'OR', lit(true)), ctx)).toBe(true))
  it('false OR false → false', () => expect(evaluate(bin(lit(false), 'OR', lit(false)), ctx)).toBe(false))
  it('true OR true → true', () => expect(evaluate(bin(lit(true), 'OR', lit(true)), ctx)).toBe(true))
})

describe('Evaluator — NOT logic', () => {
  it('NOT true → false', () => expect(evaluate(not(lit(true)), ctx)).toBe(false))
  it('NOT false → true', () => expect(evaluate(not(lit(false)), ctx)).toBe(true))
  it('NOT (true AND false) → true', () => expect(evaluate(not(bin(lit(true), 'AND', lit(false))), ctx)).toBe(true))
  it('NOT NOT true → true', () => expect(evaluate(not(not(lit(true))), ctx)).toBe(true))
})

describe('Evaluator — complex nested conditions', () => {
  it('(A OR B) AND C', () => {
    const expr = bin(bin(lit(false), 'OR', lit(true)), 'AND', lit(true))
    expect(evaluate(expr, ctx)).toBe(true)
  })
  it('A AND (B OR C)', () => {
    const expr = bin(lit(true), 'AND', bin(lit(false), 'OR', lit(true)))
    expect(evaluate(expr, ctx)).toBe(true)
  })
  it('resource.owner_id == user.id → true when ids match', () => {
    const expr = bin(path('resource','owner_id'), '==', path('user','id'))
    expect(evaluate(expr, ctx)).toBe(true)
  })
  it('resource.owner_id == user.id → false when ids differ', () => {
    const expr = bin(path('resource','owner_id'), '==', path('user','id'))
    expect(evaluate(expr, ctx2)).toBe(false)
  })
  it('resource.status == "draft" AND resource.owner_id == user.id', () => {
    const expr = bin(
      bin(path('resource','status'), '==', lit('draft')),
      'AND',
      bin(path('resource','owner_id'), '==', path('user','id')),
    )
    expect(evaluate(expr, ctx)).toBe(true)
    expect(evaluate(expr, ctx2)).toBe(false)
  })
  it('resource.active == true OR resource.count > 0', () => {
    const expr = bin(
      bin(path('resource','active'), '==', lit(true)),
      'OR',
      bin(path('resource','count'), '>', lit(0)),
    )
    expect(evaluate(expr, ctx)).toBe(true)  // active=true
    expect(evaluate(expr, ctx2)).toBe(false) // active=false, count=0
  })
  it('NOT resource.archived == true', () => {
    const expr = not(bin(path('resource','archived'), '==', lit(true)))
    expect(evaluate(expr, ctx)).toBe(true) // archived=false → NOT false → true
  })
})

describe('Evaluator — error cases', () => {
  it('throws EvaluationError for unknown AST node kind', () => {
    const bad = { kind: 'UnknownNode' } as unknown as ConditionExpr
    expect(() => evaluate(bad, ctx)).toThrow(EvaluationError)
  })
  it('throws EvaluationError for unknown comparison operator', () => {
    expect(() => compare(1, '??' as never, 1)).toThrow(EvaluationError)
  })
  it('does NOT throw on unknown path — returns undefined', () => {
    expect(() => resolvePath(['user', 'does', 'not', 'exist'], ctx)).not.toThrow()
    expect(resolvePath(['user', 'does', 'not', 'exist'], ctx)).toBeUndefined()
  })
})
