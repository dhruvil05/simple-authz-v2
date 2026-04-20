import { describe, it, expect } from 'vitest'
import { compile } from '../../src/compiler.js'
import { CompileError } from '../../src/errors.js'
import type { PolicyDocument } from '../../src/types/ast.js'

const emptyDoc: PolicyDocument = {
  kind: 'PolicyDocument',
  nodes: [],
  sourcePath: 'test.toon',
}

describe('Compiler', () => {
  describe('empty policy', () => {
    it.todo('compiles an empty PolicyDocument to an empty index')
    it.todo('sourcePath is preserved on CompiledPolicy')
  })

  describe('index structure', () => {
    it.todo('a rule with role=admin action=edit resource=listing creates correct index path')
    it.todo('two rules for the same role+action+resource are stored as array of 2')
    it.todo('wildcard action * stored under key "*" in action map')
    it.todo('wildcard resource * stored under key "*" in resource map')
    it.todo('wildcard action AND resource both stored under "*"')
    it.todo('index is a Map<string, Map<string, Map<string, CompiledRule[]>>>')
  })

  describe('CompiledRule shape', () => {
    it.todo('CompiledRule.effect is "allow" for allow rules')
    it.todo('CompiledRule.effect is "deny" for deny rules')
    it.todo('CompiledRule.condition is null when rule has no condition')
    it.todo('CompiledRule.condition is a ConditionExpr (not a string) when present')
    it.todo('CompiledRule.sourceLine matches RuleNode.line from AST')
  })

  describe('role hierarchy expansion', () => {
    it.todo('super_admin inherits all rules of admin after expansion')
    it.todo('three-level hierarchy: super > admin > editor all expanded correctly')
    it.todo('role with no hierarchy entries has only its own rules')
    it.todo('expansion does not mutate original AST nodes')
    it.todo('expanded rules from parent have correct CompiledRule.role value')
  })

  describe('cycle detection', () => {
    it('throws CompileError on empty doc (placeholder until cycle logic is ready)', () => {
      expect(() => compile(emptyDoc)).toThrow()
    })

    it.todo('throws CompileError when role extends itself: admin extends admin')
    it.todo('throws CompileError on two-role cycle: A extends B, B extends A')
    it.todo('throws CompileError on three-role cycle: A→B→C→A')
    it.todo('CompileError message names the roles involved in the cycle')
  })

  describe('include directive', () => {
    it.todo('IncludeNode paths are resolved relative to the sourcePath')
    it.todo('included file rules are merged into the index')
    it.todo('circular includes throw CompileError')
  })

  describe('deny rule precedence', () => {
    it.todo('deny rule and allow rule for same role+action+resource both stored')
    it.todo('deny rules are marked as effect:"deny" in CompiledRule')
  })

  describe('error cases', () => {
    it.todo('throws CompileError when role_hierarchy references undefined role')
    it.todo('CompileError includes sourcePath')
  })
})
