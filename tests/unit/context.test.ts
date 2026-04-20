import { describe, it, expect } from 'vitest'
import { buildContext } from '../../src/context.js'
import { ContextError } from '../../src/errors.js'

describe('Context builder', () => {
  describe('basic construction', () => {
    it.todo('returns EvalContext with user, resource, ctx keys')
    it.todo('user values are preserved correctly')
    it.todo('resource values are preserved correctly')
    it.todo('ctx defaults to empty object when undefined is passed')
  })

  describe('immutability', () => {
    it.todo('returned user object is frozen')
    it.todo('returned resource object is frozen')
    it.todo('returned ctx object is frozen')
    it.todo('nested objects inside user are also frozen')
    it.todo('mutating the original user after buildContext does not affect context')
  })

  describe('prototype pollution protection', () => {
    it('throws ContextError when user contains __proto__ key', () => {
      const dangerous = JSON.parse('{"__proto__": {"isAdmin": true}}') as object
      expect(() => buildContext(dangerous, {}, {}, 10)).toThrow(ContextError)
    })

    it.todo('throws ContextError when user contains "constructor" key')
    it.todo('throws ContextError when user contains "prototype" key')
    it.todo('throws ContextError when resource contains __proto__ key')
    it.todo('throws ContextError when nested object contains dangerous key')
    it.todo('normal keys like "proto" (without underscores) are allowed')
  })

  describe('depth limit', () => {
    it.todo('object at exactly maxDepth is accepted')
    it.todo('object exceeding maxDepth throws ContextError')
    it.todo('ContextError message mentions the depth limit')
    it.todo('flat object at depth 1 always accepted regardless of maxDepth')
  })

  describe('type coercion', () => {
    it.todo('string values preserved as strings')
    it.todo('number values preserved as numbers')
    it.todo('boolean values preserved as booleans')
    it.todo('null values preserved as null')
    it.todo('undefined values preserved as undefined')
    it.todo('arrays inside objects are cloned, not referenced')
  })

  describe('edge cases', () => {
    it.todo('empty object {} is valid for user')
    it.todo('object with 100 top-level keys is accepted')
    it.todo('non-object user (string) throws ContextError')
    it.todo('null passed as user throws ContextError')
  })
})
