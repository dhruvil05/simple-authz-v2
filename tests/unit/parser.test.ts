import { describe, it, expect } from 'vitest'
import { tokenize } from '../../src/lexer.js'
import { parse } from '../../src/parser.js'
import { ParseError } from '../../src/errors.js'
import type { Token, RuleNode, RoleHierarchyNode, IncludeNode, BinaryExpr, UnaryExpr, PathExpr, LiteralExpr } from '../../src/types/ast.js'

const parseSource = (src: string) => parse(tokenize(src, 'test.toon'), 'test.toon')

const minimalRule = `rule\n  role admin\n  action *\n  resource *\nend`

describe('Parser — valid rule blocks', () => {
  it('parses a minimal rule with role + action + resource', () => {
    const doc = parseSource(minimalRule)
    expect(doc.nodes).toHaveLength(1)
    const rule = doc.nodes[0] as RuleNode
    expect(rule.kind).toBe('RuleNode')
    expect(rule.role).toBe('admin')
    expect(rule.action).toBe('*')
    expect(rule.resource).toBe('*')
  })
  it('default effect is allow when effect line is omitted', () => {
    const doc = parseSource(minimalRule)
    const rule = doc.nodes[0] as RuleNode
    expect(rule.effect).toBe('allow')
  })
  it('parses a rule with effect: allow (explicit)', () => {
    const src = `rule\n  role admin\n  action *\n  resource *\n  effect allow\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    expect(rule.effect).toBe('allow')
  })
  it('parses a rule with effect: deny', () => {
    const src = `rule\n  role admin\n  action delete\n  resource archive\n  effect deny\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    expect(rule.effect).toBe('deny')
  })
  it('parses a rule with wildcard action: *', () => {
    const rule = parseSource(minimalRule).nodes[0] as RuleNode
    expect(rule.action).toBe('*')
  })
  it('parses a rule with wildcard resource: *', () => {
    const rule = parseSource(minimalRule).nodes[0] as RuleNode
    expect(rule.resource).toBe('*')
  })
  it('RuleNode.condition is null when no condition is present', () => {
    const rule = parseSource(minimalRule).nodes[0] as RuleNode
    expect(rule.condition).toBeNull()
  })
  it('parses a rule with a simple condition: resource.owner_id == user.id', () => {
    const src = `rule\n  role broker\n  action edit\n  resource listing\n  condition resource.owner_id == user.id\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    expect(rule.condition).not.toBeNull()
    const cond = rule.condition as BinaryExpr
    expect(cond.kind).toBe('BinaryExpr')
    expect(cond.operator).toBe('==')
  })
  it('parses condition with string literal: resource.status == "draft"', () => {
    const src = `rule\n  role broker\n  action edit\n  resource listing\n  condition resource.status == "draft"\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    const right = cond.right as LiteralExpr
    expect(right.value).toBe('draft')
  })
  it('parses condition with number literal: resource.count > 0', () => {
    const src = `rule\n  role user\n  action view\n  resource item\n  condition resource.count > 0\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    const right = cond.right as LiteralExpr
    expect(right.value).toBe(0)
    expect(cond.operator).toBe('>')
  })
  it('parses condition with boolean: resource.active == true', () => {
    const src = `rule\n  role user\n  action view\n  resource item\n  condition resource.active == true\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    const right = cond.right as LiteralExpr
    expect(right.value).toBe(true)
  })
  it('parses condition with OR', () => {
    const src = `rule\n  role user\n  action view\n  resource listing\n  condition resource.status == "public" OR resource.owner_id == user.id\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    expect(cond.operator).toBe('OR')
  })
  it('parses condition with AND', () => {
    const src = `rule\n  role broker\n  action edit\n  resource listing\n  condition resource.owner_id == user.id AND resource.status == "draft"\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    expect(cond.operator).toBe('AND')
  })
  it('parses condition with NOT', () => {
    const src = `rule\n  role broker\n  action edit\n  resource listing\n  condition NOT resource.archived == true\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as UnaryExpr
    expect(cond.kind).toBe('UnaryExpr')
    expect(cond.operator).toBe('NOT')
  })
  it('AND binds tighter than OR: A OR B AND C => A OR (B AND C)', () => {
    const src = `rule\n  role user\n  action view\n  resource x\n  condition resource.a == true OR resource.b == true AND resource.c == true\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    // top-level should be OR
    expect(cond.operator).toBe('OR')
    // right side should be AND
    const right = cond.right as BinaryExpr
    expect(right.operator).toBe('AND')
  })
})

describe('Parser — multiple rules', () => {
  it('parses two consecutive rules', () => {
    const src = `${minimalRule}\n${minimalRule}`
    const doc = parseSource(src)
    expect(doc.nodes).toHaveLength(2)
  })
  it('rules preserve source order', () => {
    const src = `rule\n  role admin\n  action delete\n  resource x\nend\nrule\n  role user\n  action view\n  resource y\nend`
    const doc = parseSource(src)
    expect((doc.nodes[0] as RuleNode).role).toBe('admin')
    expect((doc.nodes[1] as RuleNode).role).toBe('user')
  })
})

describe('Parser — role_hierarchy block', () => {
  it('parses a single hierarchy entry', () => {
    const src = `role_hierarchy\n  super_admin extends admin\nend`
    const doc = parseSource(src)
    const node = doc.nodes[0] as RoleHierarchyNode
    expect(node.kind).toBe('RoleHierarchyNode')
    expect(node.entries[0]!.role).toBe('super_admin')
    expect(node.entries[0]!.extends).toEqual(['admin'])
  })
  it('parses multiple entries in one block', () => {
    const src = `role_hierarchy\n  super_admin extends admin\n  admin extends editor\nend`
    const doc = parseSource(src)
    const node = doc.nodes[0] as RoleHierarchyNode
    expect(node.entries).toHaveLength(2)
  })
  it('parses multiple extends targets with commas', () => {
    const src = `role_hierarchy\n  super_admin extends admin, editor\nend`
    const doc = parseSource(src)
    const node = doc.nodes[0] as RoleHierarchyNode
    expect(node.entries[0]!.extends).toEqual(['admin', 'editor'])
  })
})

describe('Parser — include directive', () => {
  it('parses include directive as IncludeNode', () => {
    const src = `include "./other.toon"`
    const doc = parseSource(src)
    const node = doc.nodes[0] as IncludeNode
    expect(node.kind).toBe('IncludeNode')
  })
  it('include node preserves the path string exactly', () => {
    const src = `include "./policies/base.toon"`
    const doc = parseSource(src)
    const node = doc.nodes[0] as IncludeNode
    expect(node.path).toBe('./policies/base.toon')
  })
})

describe('Parser — comments', () => {
  it('ignores # comments between rules', () => {
    const src = `# comment\n${minimalRule}`
    const doc = parseSource(src)
    expect(doc.nodes).toHaveLength(1)
  })
  it('ignores inline comments after keywords', () => {
    const src = `rule # comment\n  role admin # inline\n  action * # another\n  resource *\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    expect(rule.role).toBe('admin')
    expect(rule.action).toBe('*')
  })
})

describe('Parser — PolicyDocument shape', () => {
  it('returns a PolicyDocument with kind: "PolicyDocument"', () => {
    const doc = parseSource(minimalRule)
    expect(doc.kind).toBe('PolicyDocument')
  })
  it('sourcePath is set correctly', () => {
    const doc = parse(tokenize(minimalRule, 'my.toon'), 'my.toon')
    expect(doc.sourcePath).toBe('my.toon')
  })
  it('empty policy file produces a PolicyDocument with 0 nodes', () => {
    const doc = parseSource('')
    expect(doc.nodes).toHaveLength(0)
  })
})

describe('Parser — RuleNode shape', () => {
  it('RuleNode has kind: "RuleNode"', () => {
    const rule = parseSource(minimalRule).nodes[0] as RuleNode
    expect(rule.kind).toBe('RuleNode')
  })
  it('RuleNode.line is the line number of the "rule" keyword', () => {
    const rule = parseSource(minimalRule).nodes[0] as RuleNode
    expect(rule.line).toBe(1)
  })
})

describe('Parser — error cases', () => {
  it('throws ParseError for empty token stream', () => {
    expect(() => parse([], 'test.toon')).toThrow(ParseError)
  })
  it('throws ParseError when "end" keyword is missing', () => {
    const src = `rule\n  role admin\n  action *\n  resource *\n`
    expect(() => parseSource(src)).toThrow(ParseError)
  })
  it('throws ParseError when "role" line is missing from rule block', () => {
    const src = `rule\n  action *\n  resource *\nend`
    expect(() => parseSource(src)).toThrow(ParseError)
  })
  it('throws ParseError when "action" line is missing from rule block', () => {
    const src = `rule\n  role admin\n  resource *\nend`
    expect(() => parseSource(src)).toThrow(ParseError)
  })
  it('throws ParseError when "resource" line is missing from rule block', () => {
    const src = `rule\n  role admin\n  action *\nend`
    expect(() => parseSource(src)).toThrow(ParseError)
  })
  it('throws ParseError on duplicate "role" inside one rule block', () => {
    const src = `rule\n  role admin\n  role user\n  action *\n  resource *\nend`
    expect(() => parseSource(src)).toThrow(ParseError)
  })
  it('ParseError sourcePath matches the input path', () => {
    try { parse([], 'my-policy.toon') } catch(e) {
      expect((e as ParseError).sourcePath).toBe('my-policy.toon')
    }
  })
  it('throws ParseError when effect value is not allow or deny', () => {
    const src = `rule\n  role admin\n  action *\n  resource *\n  effect maybe\nend`
    expect(() => parseSource(src)).toThrow(ParseError)
  })
  it('throws ParseError for invalid path root in condition', () => {
    const src = `rule\n  role admin\n  action edit\n  resource x\n  condition request.id == user.id\nend`
    expect(() => parseSource(src)).toThrow(ParseError)
  })
})

describe('Parser — AST node shapes', () => {
  it('PathExpr.segments splits "user.id" into ["user","id"]', () => {
    const src = `rule\n  role admin\n  action edit\n  resource x\n  condition user.id == resource.id\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    const left = cond.left as PathExpr
    expect(left.segments).toEqual(['user', 'id'])
  })
  it('PathExpr.segments splits three-level path', () => {
    const src = `rule\n  role admin\n  action edit\n  resource x\n  condition resource.meta.tag == "x"\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    const left = cond.left as PathExpr
    expect(left.segments).toEqual(['resource', 'meta', 'tag'])
  })
  it('LiteralExpr.value is a JS number for numeric literals', () => {
    const src = `rule\n  role user\n  action view\n  resource x\n  condition resource.count > 5\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    const right = cond.right as LiteralExpr
    expect(typeof right.value).toBe('number')
    expect(right.value).toBe(5)
  })
  it('LiteralExpr.value is a JS boolean for boolean literals', () => {
    const src = `rule\n  role user\n  action view\n  resource x\n  condition resource.active == true\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    const right = cond.right as LiteralExpr
    expect(typeof right.value).toBe('boolean')
    expect(right.value).toBe(true)
  })
  it('LiteralExpr.value is a JS string without quotes for string literals', () => {
    const src = `rule\n  role user\n  action view\n  resource x\n  condition resource.status == "active"\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    const right = cond.right as LiteralExpr
    expect(right.value).toBe('active')
  })
  it('LiteralExpr.value is null for null literal', () => {
    const src = `rule\n  role user\n  action view\n  resource x\n  condition resource.owner == null\nend`
    const rule = parseSource(src).nodes[0] as RuleNode
    const cond = rule.condition as BinaryExpr
    const right = cond.right as LiteralExpr
    expect(right.value).toBeNull()
  })
})
