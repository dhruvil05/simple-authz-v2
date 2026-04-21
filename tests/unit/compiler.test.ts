import { describe, it, expect } from 'vitest'
import { compile, detectCycles, expandHierarchy } from '../../src/compiler.js'
import { CompileError } from '../../src/errors.js'
import { tokenize } from '../../src/lexer.js'
import { parse } from '../../src/parser.js'
import type { PolicyDocument, RuleNode, ConditionExpr } from '../../src/types/ast.js'
import type { CompiledRule } from '../../src/compiler.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseSource = (src: string): PolicyDocument =>
  parse(tokenize(src, 'test.toon'), 'test.toon')

const compileSource = (src: string) => compile(parseSource(src))

const emptyDoc: PolicyDocument = {
  kind: 'PolicyDocument',
  nodes: [],
  sourcePath: 'test.toon',
}

const simpleRule = `rule\n  role admin\n  action edit\n  resource listing\nend`

function getRules(src: string, role: string, action: string, resource: string): CompiledRule[] {
  const policy = compileSource(src)
  return policy.index.get(role)?.get(action)?.get(resource) ?? []
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Compiler — empty policy', () => {
  it('compiles an empty PolicyDocument to an empty index', () => {
    const policy = compile(emptyDoc)
    expect(policy.index.size).toBe(0)
  })
  it('sourcePath is preserved on CompiledPolicy', () => {
    const policy = compile(emptyDoc)
    expect(policy.sourcePath).toBe('test.toon')
  })
})

describe('Compiler — index structure', () => {
  it('creates correct index path for role=admin action=edit resource=listing', () => {
    const policy = compileSource(simpleRule)
    expect(policy.index.has('admin')).toBe(true)
    expect(policy.index.get('admin')!.has('edit')).toBe(true)
    expect(policy.index.get('admin')!.get('edit')!.has('listing')).toBe(true)
  })
  it('two rules for the same role+action+resource are stored as array of 2', () => {
    const src = `${simpleRule}\n${simpleRule}`
    const rules = getRules(src, 'admin', 'edit', 'listing')
    expect(rules).toHaveLength(2)
  })
  it('wildcard action * stored under key "*" in action map', () => {
    const src = `rule\n  role admin\n  action *\n  resource listing\nend`
    const policy = compileSource(src)
    expect(policy.index.get('admin')!.has('*')).toBe(true)
  })
  it('wildcard resource * stored under key "*" in resource map', () => {
    const src = `rule\n  role admin\n  action edit\n  resource *\nend`
    const policy = compileSource(src)
    expect(policy.index.get('admin')!.get('edit')!.has('*')).toBe(true)
  })
  it('wildcard action AND resource both stored under "*"', () => {
    const src = `rule\n  role admin\n  action *\n  resource *\nend`
    const policy = compileSource(src)
    expect(policy.index.get('admin')!.get('*')!.has('*')).toBe(true)
  })
  it('index is a nested Map structure', () => {
    const policy = compileSource(simpleRule)
    expect(policy.index).toBeInstanceOf(Map)
    expect(policy.index.get('admin')).toBeInstanceOf(Map)
    expect(policy.index.get('admin')!.get('edit')).toBeInstanceOf(Map)
    expect(Array.isArray(policy.index.get('admin')!.get('edit')!.get('listing'))).toBe(true)
  })
  it('two different roles each get their own index entry', () => {
    const src = `rule\n  role admin\n  action edit\n  resource listing\nend\nrule\n  role user\n  action view\n  resource listing\nend`
    const policy = compileSource(src)
    expect(policy.index.has('admin')).toBe(true)
    expect(policy.index.has('user')).toBe(true)
  })
})

describe('Compiler — CompiledRule shape', () => {
  it('CompiledRule.effect is "allow" for allow rules', () => {
    const rules = getRules(simpleRule, 'admin', 'edit', 'listing')
    expect(rules[0]!.effect).toBe('allow')
  })
  it('CompiledRule.effect is "deny" for deny rules', () => {
    const src = `rule\n  role admin\n  action delete\n  resource archive\n  effect deny\nend`
    const rules = getRules(src, 'admin', 'delete', 'archive')
    expect(rules[0]!.effect).toBe('deny')
  })
  it('CompiledRule.condition is null when rule has no condition', () => {
    const rules = getRules(simpleRule, 'admin', 'edit', 'listing')
    expect(rules[0]!.condition).toBeNull()
  })
  it('CompiledRule.condition is a ConditionExpr object when present', () => {
    const src = `rule\n  role broker\n  action edit\n  resource listing\n  condition resource.owner_id == user.id\nend`
    const rules = getRules(src, 'broker', 'edit', 'listing')
    expect(rules[0]!.condition).not.toBeNull()
    expect(typeof rules[0]!.condition).toBe('object')
    expect((rules[0]!.condition as ConditionExpr).kind).toBe('BinaryExpr')
  })
  it('CompiledRule.sourceLine matches RuleNode.line from AST', () => {
    const rules = getRules(simpleRule, 'admin', 'edit', 'listing')
    expect(rules[0]!.sourceLine).toBe(1)
  })
  it('deny and allow rules for same slot are both stored', () => {
    const src = `rule\n  role admin\n  action edit\n  resource listing\n  effect allow\nend\nrule\n  role admin\n  action edit\n  resource listing\n  effect deny\nend`
    const rules = getRules(src, 'admin', 'edit', 'listing')
    expect(rules).toHaveLength(2)
    const effects = rules.map(r => r.effect).sort()
    expect(effects).toEqual(['allow', 'deny'])
  })
})

describe('Compiler — role hierarchy expansion', () => {
  const hierarchySrc = `role_hierarchy\n  super_admin extends admin\n  admin extends editor\n  editor extends viewer\nend\nrule\n  role viewer\n  action view\n  resource listing\nend\nrule\n  role editor\n  action edit\n  resource listing\nend\nrule\n  role admin\n  action delete\n  resource listing\nend\nrule\n  role super_admin\n  action purge\n  resource listing\nend`

  it('super_admin inherits viewer rules (transitive)', () => {
    const policy = compileSource(hierarchySrc)
    const rules = policy.index.get('super_admin')!.get('view')?.get('listing') ?? []
    expect(rules.length).toBeGreaterThan(0)
  })
  it('super_admin inherits editor rules (transitive)', () => {
    const policy = compileSource(hierarchySrc)
    const rules = policy.index.get('super_admin')!.get('edit')?.get('listing') ?? []
    expect(rules.length).toBeGreaterThan(0)
  })
  it('super_admin inherits admin rules (direct)', () => {
    const policy = compileSource(hierarchySrc)
    const rules = policy.index.get('super_admin')!.get('delete')?.get('listing') ?? []
    expect(rules.length).toBeGreaterThan(0)
  })
  it('super_admin has its own rules too', () => {
    const policy = compileSource(hierarchySrc)
    const rules = policy.index.get('super_admin')!.get('purge')?.get('listing') ?? []
    expect(rules.length).toBeGreaterThan(0)
  })
  it('viewer only has its own rules — not editor or admin', () => {
    const policy = compileSource(hierarchySrc)
    expect(policy.index.get('viewer')!.has('edit')).toBe(false)
    expect(policy.index.get('viewer')!.has('delete')).toBe(false)
  })
  it('inherited rules have the child role stamped on them', () => {
    const policy = compileSource(hierarchySrc)
    const rules = policy.index.get('super_admin')!.get('view')?.get('listing') ?? []
    for (const r of rules) expect(r.role).toBe('super_admin')
  })
  it('role with no hierarchy has only its own rules', () => {
    const src = `rule\n  role admin\n  action edit\n  resource listing\nend`
    const policy = compileSource(src)
    const adminRules = [...(policy.index.get('admin')?.values() ?? [])].flatMap(m => [...m.values()]).flat()
    expect(adminRules.every(r => r.role === 'admin')).toBe(true)
  })
})

describe('Compiler — cycle detection', () => {
  it('does NOT throw for an empty graph', () => {
    expect(() => detectCycles(new Map(), 'test.toon')).not.toThrow()
  })
  it('throws CompileError when role extends itself', () => {
    const src = `role_hierarchy\n  admin extends admin\nend`
    expect(() => compileSource(src)).toThrow(CompileError)
  })
  it('throws CompileError on two-role cycle: A extends B, B extends A', () => {
    const graph = new Map([['a', ['b']], ['b', ['a']]])
    expect(() => detectCycles(graph, 'test.toon')).toThrow(CompileError)
  })
  it('throws CompileError on three-role cycle: A→B→C→A', () => {
    const graph = new Map([['a', ['b']], ['b', ['c']], ['c', ['a']]])
    expect(() => detectCycles(graph, 'test.toon')).toThrow(CompileError)
  })
  it('CompileError message names the roles in the cycle', () => {
    const graph = new Map([['editor', ['viewer']], ['viewer', ['editor']]])
    let msg = ''
    try { detectCycles(graph, 'test.toon') } catch(e) { msg = (e as CompileError).message }
    expect(msg).toContain('editor')
    expect(msg).toContain('viewer')
  })
  it('CompileError includes sourcePath', () => {
    const src = `role_hierarchy\n  admin extends admin\nend`
    let err: CompileError | null = null
    try { compileSource(src) } catch(e) { err = e as CompileError }
    expect(err).not.toBeNull()
    expect(err!.sourcePath).toBe('test.toon')
  })
  it('non-cyclic hierarchy does not throw', () => {
    const src = `role_hierarchy\n  super_admin extends admin\n  admin extends editor\nend\nrule\n  role editor\n  action view\n  resource x\nend`
    expect(() => compileSource(src)).not.toThrow()
  })
})

describe('Compiler — multiple rules merge correctly', () => {
  it('compiles 5 different rules into the index', () => {
    const src = [
      `rule\n  role admin\n  action *\n  resource *\nend`,
      `rule\n  role broker\n  action publish\n  resource listing\nend`,
      `rule\n  role broker\n  action edit\n  resource listing\n  condition resource.owner_id == user.id\nend`,
      `rule\n  role user\n  action view\n  resource listing\nend`,
      `rule\n  role user\n  action view\n  resource profile\nend`,
    ].join('\n')
    const policy = compileSource(src)
    expect(policy.index.size).toBeGreaterThanOrEqual(3)
    expect(policy.index.has('admin')).toBe(true)
    expect(policy.index.has('broker')).toBe(true)
    expect(policy.index.has('user')).toBe(true)
  })
})
