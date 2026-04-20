import { describe, it, expect } from 'vitest'
import { parse } from '../../src/parser.js'
import { ParseError } from '../../src/errors.js'
import type { Token } from '../../src/types/ast.js'

const emptyTokens: Token[] = []

describe('Parser', () => {
  describe('valid rule blocks', () => {
    it.todo('parses a minimal rule with role + action + resource')
    it.todo('parses a rule with effect: allow (explicit)')
    it.todo('parses a rule with effect: deny')
    it.todo('default effect is allow when effect line is omitted')
    it.todo('parses a rule with wildcard action: *')
    it.todo('parses a rule with wildcard resource: *')
    it.todo('parses a rule with wildcard action AND wildcard resource')
    it.todo('parses a rule with a simple condition: listing.owner_id == user.id')
    it.todo('parses a rule with condition using string literal: listing.status == "draft"')
    it.todo('parses a rule with condition using number literal: resource.count > 0')
    it.todo('parses a rule with condition using boolean: resource.active == true')
    it.todo('parses a rule with OR condition')
    it.todo('parses a rule with AND condition')
    it.todo('parses a rule with NOT condition')
    it.todo('parses a rule with nested AND/OR: (A OR B) AND C')
  })

  describe('multiple rules', () => {
    it.todo('parses two consecutive rules into a PolicyDocument with 2 nodes')
    it.todo('parses 10 rules correctly')
    it.todo('rules preserve source order in output nodes array')
  })

  describe('role_hierarchy block', () => {
    it.todo('parses a single role_hierarchy entry: super_admin extends admin')
    it.todo('parses multiple entries in one role_hierarchy block')
    it.todo('parses multiple extends targets: editor extends viewer, commenter')
  })

  describe('include directive', () => {
    it.todo('parses include "./other.toon" as IncludeNode')
    it.todo('include node preserves the path string exactly')
  })

  describe('comments', () => {
    it.todo('ignores # comments between rules')
    it.todo('ignores # comments inside a rule block')
    it.todo('ignores # comment on same line as a keyword')
  })

  describe('PolicyDocument shape', () => {
    it.todo('returns a PolicyDocument with kind: "PolicyDocument"')
    it.todo('sourcePath is set correctly on the document')
    it.todo('empty policy file produces a PolicyDocument with 0 nodes')
  })

  describe('RuleNode shape', () => {
    it.todo('RuleNode has kind: "RuleNode"')
    it.todo('RuleNode.line is the line number of the "rule" keyword')
    it.todo('RuleNode.condition is null when no condition is present')
  })

  describe('error cases', () => {
    it('throws ParseError for empty token stream given to parse()', () => {
      expect(() => parse(emptyTokens, 'test.toon')).toThrow(ParseError)
    })

    it.todo('throws ParseError when "end" keyword is missing')
    it.todo('throws ParseError when "role" line is missing from rule block')
    it.todo('throws ParseError when "action" line is missing from rule block')
    it.todo('throws ParseError when "resource" line is missing from rule block')
    it.todo('throws ParseError on unknown keyword inside rule block')
    it.todo('throws ParseError on duplicate "role" inside one rule block')
    it.todo('throws ParseError on malformed condition expression')
    it.todo('ParseError line number points to the offending line')
    it.todo('ParseError column number points to the offending column')
    it.todo('ParseError sourcePath matches the input path')
  })

  describe('AST correctness', () => {
    it.todo('BinaryExpr.left and .right are correct ConditionExpr types')
    it.todo('UnaryExpr.operand is a correct ConditionExpr')
    it.todo('PathExpr.segments splits "user.id" into ["user", "id"]')
    it.todo('PathExpr.segments splits "ctx.tenant.id" into ["ctx", "tenant", "id"]')
    it.todo('LiteralExpr.value is a JS number for numeric literals')
    it.todo('LiteralExpr.value is a JS boolean for boolean literals')
    it.todo('LiteralExpr.value is a JS string (without quotes) for string literals')
  })
})
