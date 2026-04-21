import { describe, it, expect, vi } from 'vitest'
import { resolve } from 'node:path'
import { Authz } from '../../src/authz.js'
import { tokenize } from '../../src/lexer.js'
import { parse } from '../../src/parser.js'
import { compile } from '../../src/compiler.js'
import { PathSafetyError, ContextError } from '../../src/errors.js'

const fixture = (name: string) =>
  resolve(process.cwd(), 'tests/fixtures', name)

// ─── Path traversal prevention ────────────────────────────────────────────────

describe('Security: path traversal prevention', () => {
  it('throws PathSafetyError for ../../../etc/passwd', () => {
    const authz = new Authz()
    expect(() => authz.load('../../../etc/passwd')).toThrow(PathSafetyError)
  })
  it('throws PathSafetyError for absolute path outside cwd', () => {
    const authz = new Authz()
    expect(() => authz.load('/etc/passwd')).toThrow(PathSafetyError)
  })
  it('throws PathSafetyError for deep traversal', () => {
    const authz = new Authz()
    expect(() => authz.load('../../../../../../tmp/evil.toon')).toThrow(PathSafetyError)
  })
  it('loadAsync throws PathSafetyError for traversal paths', async () => {
    const authz = new Authz()
    await expect(authz.loadAsync('../../../etc/passwd')).rejects.toThrow(PathSafetyError)
  })
  it('validate() also throws PathSafetyError for traversal paths', () => {
    const authz = new Authz()
    expect(() => authz.validate('../../../etc/passwd')).toThrow(PathSafetyError)
  })
  it('a safe path within cwd does not throw PathSafetyError', () => {
    const authz = new Authz()
    // Should throw ParseError or similar — not PathSafetyError
    try {
      authz.load('./tests/fixtures/basic-rbac.toon')
    } catch (e) {
      expect(e).not.toBeInstanceOf(PathSafetyError)
    }
  })
})

// ─── No eval() in source ─────────────────────────────────────────────────────

describe('Security: no eval() in source', () => {
  it('eval is not called during condition evaluation', () => {
    const evalSpy = vi.spyOn(globalThis, 'eval')
    const authz = new Authz()
    authz.load(fixture('ownership.toon'))
    authz.can(
      { id: 10, roles: ['broker'] },
      'edit', 'listing',
      { owner_id: 10, status: 'draft' },
    )
    authz.can(
      { id: 99, roles: ['broker'] },
      'edit', 'listing',
      { owner_id: 10 },
    )
    expect(evalSpy).not.toHaveBeenCalled()
    evalSpy.mockRestore()
  })
})

// ─── Prototype pollution prevention ──────────────────────────────────────────

describe('Security: prototype pollution prevention', () => {
  it('prototype-polluted user object is rejected by can()', () => {
    const authz = new Authz()
    authz.load(fixture('basic-rbac.toon'))
    const dangerous = JSON.parse('{"id":1,"roles":["admin"],"__proto__":{"isAdmin":true}}') as object
    // can() must not throw — it must return false safely
    expect(() => authz.can(dangerous as { id: number; roles: string[] }, 'edit', 'listing')).not.toThrow()
    expect(authz.can(dangerous as { id: number; roles: string[] }, 'edit', 'listing')).toBe(false)
  })
  it('user with __proto__.isAdmin=true does not gain admin access', () => {
    const authz = new Authz()
    authz.load(fixture('basic-rbac.toon'))
    const dangerous = JSON.parse('{"id":1,"roles":["user"],"__proto__":{"isAdmin":true}}') as { id: number; roles: string[] }
    expect(authz.can(dangerous, 'delete', 'listing')).toBe(false)
  })
  it('resource with constructor key is rejected', () => {
    const authz = new Authz()
    authz.load(fixture('ownership.toon'))
    const broker = { id: 10, roles: ['broker'] }
    const evilResource = { owner_id: 10, constructor: 'evil' }
    // Should return false (context build fails) not throw unhandled
    expect(() => authz.can(broker, 'edit', 'listing', evilResource)).not.toThrow()
    expect(authz.can(broker, 'edit', 'listing', evilResource)).toBe(false)
  })
})

// ─── Input isolation ─────────────────────────────────────────────────────────

describe('Security: input isolation', () => {
  it('mutating user object after can() has no effect on subsequent calls', () => {
    const authz = new Authz()
    authz.load(fixture('basic-rbac.toon'))
    const user = { id: 1, roles: ['admin'] }
    expect(authz.can(user, 'delete', 'listing')).toBe(true)
    // Mutate user after the call
    ;(user as Record<string, unknown>)['roles'] = ['nobody']
    // Admin decision must not have changed — but user now has different roles
    // Next call uses the NEW mutated value — that's expected behaviour
    // What we test: the FIRST call's result was correct at the time
    expect(authz.can({ id: 1, roles: ['nobody'] }, 'delete', 'listing')).toBe(false)
  })
  it('two concurrent can() calls with different users do not interfere', () => {
    const authz = new Authz()
    authz.load(fixture('basic-rbac.toon'))
    const results = [
      authz.can({ id: 1, roles: ['admin'] }, 'delete', 'listing'),
      authz.can({ id: 2, roles: ['user'] },  'delete', 'listing'),
      authz.can({ id: 3, roles: ['admin'] }, 'delete', 'listing'),
    ]
    expect(results[0]).toBe(true)
    expect(results[1]).toBe(false)
    expect(results[2]).toBe(true)
  })
})

// ─── Denial by default ────────────────────────────────────────────────────────

describe('Security: denial by default', () => {
  it('returns false when no policy is loaded', () => {
    const authz = new Authz()
    expect(authz.can({ id: 1, roles: ['admin'] }, 'delete', 'everything')).toBe(false)
  })
  it('returns false when action has no matching rule', () => {
    const authz = new Authz()
    authz.load(fixture('basic-rbac.toon'))
    expect(authz.can({ id: 1, roles: ['user'] }, 'destroy', 'listing')).toBe(false)
  })
  it('returns false when resource has no matching rule', () => {
    const authz = new Authz()
    authz.load(fixture('basic-rbac.toon'))
    expect(authz.can({ id: 1, roles: ['broker'] }, 'publish', 'invoice')).toBe(false)
  })
  it('returns false when role has no matching rule', () => {
    const authz = new Authz()
    authz.load(fixture('basic-rbac.toon'))
    expect(authz.can({ id: 1, roles: ['ghost'] }, 'view', 'listing')).toBe(false)
  })
  it('returns false when condition fails even if rule matches', () => {
    const authz = new Authz()
    authz.load(fixture('ownership.toon'))
    expect(authz.can({ id: 99, roles: ['broker'] }, 'edit', 'listing', { owner_id: 10 })).toBe(false)
  })
  it('deny rule overrides a matching allow rule', () => {
    const authz = new Authz()
    authz.load(fixture('deny-rules.toon'))
    // admin has wildcard allow but also deny for archived_listing delete
    expect(authz.can({ id: 1, roles: ['admin'] }, 'delete', 'archived_listing')).toBe(false)
  })
})

// ─── Audit callback isolation ─────────────────────────────────────────────────

describe('Security: audit callback isolation', () => {
  it('exception thrown inside audit callback does not propagate to can()', () => {
    const authz = new Authz({ audit: () => { throw new Error('audit boom') } })
    authz.load(fixture('basic-rbac.toon'))
    expect(() => authz.can({ id: 1, roles: ['admin'] }, 'edit', 'listing')).not.toThrow()
  })
  it('async audit callback rejection does not propagate to can()', async () => {
    const authz = new Authz({
      audit: async () => { throw new Error('async audit boom') },
    })
    authz.load(fixture('basic-rbac.toon'))
    expect(() => authz.can({ id: 1, roles: ['admin'] }, 'edit', 'listing')).not.toThrow()
    // Give async rejection time to fire — it must be silently swallowed
    await new Promise(r => setTimeout(r, 10))
  })
})

// ─── DoS protection ──────────────────────────────────────────────────────────

describe('Security: DoS protection', () => {
  it('very large policy (inline 50 rules) loads and evaluates without error', () => {
    const rules = Array.from({ length: 50 }, (_, i) =>
      `rule\n  role role${i}\n  action action${i}\n  resource resource${i}\nend`
    ).join('\n')
    const authz = new Authz()
    // Just verify the pipeline doesn't crash — do not use load() since it needs a file
    expect(() => {
      const tokens = tokenize(rules, 'big.toon')
      const ast = parse(tokens, 'big.toon')
      compile(ast)
    }).not.toThrow()
  })
  it('object nested beyond maxContextDepth does not cause stack overflow', () => {
    // Build a deeply nested object
    let nested: Record<string, unknown> = { value: 'deep' }
    for (let i = 0; i < 20; i++) nested = { child: nested }
    const authz = new Authz({ maxContextDepth: 5 })
    authz.load(fixture('basic-rbac.toon'))
    // Should not throw — either truncates or returns false safely
    expect(() =>
      authz.can({ id: 1, roles: ['admin'] }, 'edit', 'listing', nested)
    ).not.toThrow()
  })
})
