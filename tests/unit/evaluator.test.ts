import { describe, it, expect } from 'vitest'
import { evaluate } from '../../src/evaluator.js'
import { EvaluationError } from '../../src/errors.js'
import type { ConditionExpr, LiteralExpr, PathExpr } from '../../src/types/ast.js'
import type { EvalContext } from '../../src/context.js'

const trueExpr: LiteralExpr = { kind: 'LiteralExpr', value: true }
const falseExpr: LiteralExpr = { kind: 'LiteralExpr', value: false }

const mockCtx: EvalContext = {
  user: Object.freeze({ id: 10, roles: ['broker'] }),
  resource: Object.freeze({ owner_id: 10, status: 'draft', active: true, count: 5 }),
  ctx: Object.freeze({}),
}

describe('Evaluator', () => {
  describe('LiteralExpr', () => {
    it.todo('true literal evaluates to true')
    it.todo('false literal evaluates to false')
    it.todo('number literal evaluates to truthy/falsy correctly')
    it.todo('null literal evaluates to falsy')
  })

  describe('PathExpr resolution', () => {
    it.todo('user.id resolves to the user id value')
    it.todo('resource.owner_id resolves to the resource owner_id value')
    it.todo('ctx.tenant resolves from the ctx object')
    it.todo('unknown path segment resolves to undefined — does not throw')
    it.todo('three-level path: resource.meta.tag resolves correctly')
    it.todo('path to a non-object segment returns undefined gracefully')
  })

  describe('BinaryExpr — comparison operators', () => {
    it.todo('== returns true when values are strictly equal')
    it.todo('== returns false when values differ')
    it.todo('!= returns true when values differ')
    it.todo('!= returns false when values are equal')
    it.todo('> returns true when left is greater')
    it.todo('>= returns true when left is equal or greater')
    it.todo('< returns true when left is less')
    it.todo('<= returns true when left is equal or less')
    it.todo('string == string comparison works')
    it.todo('number == number comparison works')
    it.todo('boolean == boolean comparison works')
    it.todo('undefined == undefined returns true')
    it.todo('undefined != null returns true (strict, no coercion)')
  })

  describe('BinaryExpr — AND logic', () => {
    it.todo('true AND true → true')
    it.todo('true AND false → false')
    it.todo('false AND true → false (short-circuits, does not evaluate right)')
    it.todo('false AND false → false')
  })

  describe('BinaryExpr — OR logic', () => {
    it.todo('true OR false → true (short-circuits, does not evaluate right)')
    it.todo('false OR true → true')
    it.todo('false OR false → false')
    it.todo('true OR true → true')
  })

  describe('UnaryExpr — NOT logic', () => {
    it.todo('NOT true → false')
    it.todo('NOT false → true')
    it.todo('NOT (A AND B) inverts correctly')
  })

  describe('complex nested conditions', () => {
    it.todo('(A OR B) AND C evaluates correctly')
    it.todo('A AND (B OR C) evaluates correctly')
    it.todo('NOT (A AND B) is equivalent to (NOT A) OR (NOT B)')
    it.todo('deeply nested 4-level condition evaluates without stack overflow')
  })

  describe('real policy scenarios', () => {
    it.todo('resource.owner_id == user.id → true when ids match')
    it.todo('resource.owner_id == user.id → false when ids differ')
    it.todo('resource.status == "draft" AND resource.owner_id == user.id')
    it.todo('resource.active == true OR resource.count > 0')
  })

  describe('error cases', () => {
    it('throws EvaluationError for unknown AST node kind', () => {
      const badExpr = { kind: 'UnknownNode' } as unknown as ConditionExpr
      expect(() => evaluate(badExpr, mockCtx)).toThrow(EvaluationError)
    })

    it.todo('throws EvaluationError for unknown comparison operator')
    it.todo('does NOT throw on unknown path — returns undefined')
  })
})
