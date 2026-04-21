import { describe, it, expect } from 'vitest'
import { buildContext, _containsDangerousKey } from '../../src/context.js'
import { ContextError } from '../../src/errors.js'

describe('Context builder — basic construction', () => {
  it('returns EvalContext with user, resource, ctx keys', () => {
    const c = buildContext({ id: 1, roles: ['user'] }, { id: 5 }, {}, 10)
    expect(c).toHaveProperty('user')
    expect(c).toHaveProperty('resource')
    expect(c).toHaveProperty('ctx')
  })
  it('user values are preserved', () => {
    const c = buildContext({ id: 42, roles: ['admin'], name: 'Alice' }, {}, {}, 10)
    expect(c.user['id']).toBe(42)
    expect(c.user['name']).toBe('Alice')
  })
  it('resource values are preserved', () => {
    const c = buildContext({ id: 1, roles: [] }, { owner_id: 7, status: 'draft' }, {}, 10)
    expect(c.resource['owner_id']).toBe(7)
    expect(c.resource['status']).toBe('draft')
  })
  it('ctx defaults to empty object when undefined', () => {
    const c = buildContext({ id: 1, roles: [] }, {}, undefined, 10)
    expect(c.ctx).toEqual({})
  })
  it('resource defaults to empty object when undefined', () => {
    const c = buildContext({ id: 1, roles: [] }, undefined, {}, 10)
    expect(c.resource).toEqual({})
  })
})

describe('Context builder — immutability', () => {
  it('returned user object is frozen', () => {
    const c = buildContext({ id: 1, roles: [] }, {}, {}, 10)
    expect(Object.isFrozen(c.user)).toBe(true)
  })
  it('returned resource object is frozen', () => {
    const c = buildContext({ id: 1, roles: [] }, { x: 1 }, {}, 10)
    expect(Object.isFrozen(c.resource)).toBe(true)
  })
  it('returned ctx object is frozen', () => {
    const c = buildContext({ id: 1, roles: [] }, {}, { t: 'a' }, 10)
    expect(Object.isFrozen(c.ctx)).toBe(true)
  })
  it('nested objects inside user are also frozen', () => {
    const c = buildContext({ id: 1, roles: [], meta: { tag: 'x' } }, {}, {}, 10)
    expect(Object.isFrozen(c.user['meta'])).toBe(true)
  })
  it('mutating original after buildContext does not affect context', () => {
    const user: Record<string, unknown> = { id: 1, roles: [] }
    const c = buildContext(user, {}, {}, 10)
    user['id'] = 999
    expect(c.user['id']).toBe(1)
  })
})

describe('Context builder — prototype pollution protection', () => {
  it('throws ContextError when user contains __proto__ key', () => {
    const dangerous = JSON.parse('{"__proto__": {"isAdmin": true}}') as object
    expect(() => buildContext(dangerous, {}, {}, 10)).toThrow(ContextError)
  })
  it('throws ContextError when user contains "constructor" key', () => {
    expect(() => buildContext({ constructor: 'evil' }, {}, {}, 10)).toThrow(ContextError)
  })
  it('throws ContextError when user contains "prototype" key', () => {
    expect(() => buildContext({ prototype: {} }, {}, {}, 10)).toThrow(ContextError)
  })
  it('throws ContextError when resource contains __proto__ key', () => {
    const dangerous = JSON.parse('{"__proto__": {"hack": true}}') as object
    expect(() => buildContext({ id: 1, roles: [] }, dangerous, {}, 10)).toThrow(ContextError)
  })
  it('normal keys like "proto" (without underscores) are allowed', () => {
    expect(() => buildContext({ id: 1, roles: [], proto: 'ok' }, {}, {}, 10)).not.toThrow()
  })
  it('_containsDangerousKey detects __proto__', () => {
    const obj = JSON.parse('{"__proto__": {}}') as object
    expect(_containsDangerousKey(obj)).toBe(true)
  })
  it('_containsDangerousKey returns false for safe object', () => {
    expect(_containsDangerousKey({ id: 1, name: 'safe' })).toBe(false)
  })
})

describe('Context builder — depth limit', () => {
  it('flat object at depth 1 always accepted', () => {
    expect(() => buildContext({ id: 1, roles: [] }, { x: 1 }, {}, 1)).not.toThrow()
  })
  it('object at exactly maxDepth is accepted', () => {
    const nested = { a: { b: 'value' } }
    expect(() => buildContext({ id: 1, roles: [] }, nested, {}, 2)).not.toThrow()
  })
  it('object beyond maxDepth is truncated (not an error — stops cloning)', () => {
    const deep = { a: { b: { c: { d: 'deep' } } } }
    const c = buildContext({ id: 1, roles: [] }, deep, {}, 2)
    // At depth limit, nested objects become {}
    expect(c.resource['a']).toBeDefined()
  })
})

describe('Context builder — type handling', () => {
  it('string values preserved', () => {
    const c = buildContext({ id: 1, roles: [], name: 'Alice' }, {}, {}, 10)
    expect(c.user['name']).toBe('Alice')
  })
  it('number values preserved', () => {
    const c = buildContext({ id: 42, roles: [] }, {}, {}, 10)
    expect(c.user['id']).toBe(42)
  })
  it('boolean values preserved', () => {
    const c = buildContext({ id: 1, roles: [], active: true }, {}, {}, 10)
    expect(c.user['active']).toBe(true)
  })
  it('null values preserved', () => {
    const c = buildContext({ id: 1, roles: [], owner: null }, {}, {}, 10)
    expect(c.user['owner']).toBeNull()
  })
})

describe('Context builder — edge cases', () => {
  it('empty object {} is valid for user', () => {
    expect(() => buildContext({}, {}, {}, 10)).not.toThrow()
  })
  it('null passed as user throws ContextError', () => {
    expect(() => buildContext(null, {}, {}, 10)).toThrow(ContextError)
  })
  it('string passed as user throws ContextError', () => {
    expect(() => buildContext('not-an-object', {}, {}, 10)).toThrow(ContextError)
  })
  it('array passed as user throws ContextError', () => {
    expect(() => buildContext([], {}, {}, 10)).toThrow(ContextError)
  })
})
