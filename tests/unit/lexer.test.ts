import { describe, it, expect } from 'vitest'
import { tokenize } from '../../src/lexer.js'
import { ParseError } from '../../src/errors.js'
import type { Token } from '../../src/types/ast.js'

const kinds = (tokens: Token[]) => tokens.map(t => t.kind)
const values = (tokens: Token[]) => tokens.map(t => t.value)
const lex = (src: string) => tokenize(src, 'test.toon')

describe('Lexer — keywords', () => {
  it('tokenises "rule" keyword', () => {
    expect(kinds(lex('rule'))).toContain('KEYWORD_RULE')
  })
  it('tokenises "end" keyword', () => {
    expect(kinds(lex('end'))).toContain('KEYWORD_END')
  })
  it('tokenises "role" keyword', () => {
    expect(kinds(lex('role'))).toContain('KEYWORD_ROLE')
  })
  it('tokenises "action" keyword', () => {
    expect(kinds(lex('action'))).toContain('KEYWORD_ACTION')
  })
  it('tokenises "resource" keyword', () => {
    expect(kinds(lex('resource'))).toContain('KEYWORD_RESOURCE')
  })
  it('tokenises "condition" keyword', () => {
    expect(kinds(lex('condition'))).toContain('KEYWORD_CONDITION')
  })
  it('tokenises "effect" keyword', () => {
    expect(kinds(lex('effect'))).toContain('KEYWORD_EFFECT')
  })
  it('tokenises "include" keyword', () => {
    expect(kinds(lex('include'))).toContain('KEYWORD_INCLUDE')
  })
  it('tokenises "role_hierarchy" keyword', () => {
    expect(kinds(lex('role_hierarchy'))).toContain('KEYWORD_ROLE_HIERARCHY')
  })
  it('tokenises "extends" keyword', () => {
    expect(kinds(lex('extends'))).toContain('KEYWORD_EXTENDS')
  })
  it('keywords are case-sensitive — RULE is an IDENTIFIER', () => {
    expect(kinds(lex('RULE'))).toContain('IDENTIFIER')
  })
})

describe('Lexer — identifiers and wildcards', () => {
  it('tokenises a simple identifier: admin', () => {
    const toks = lex('admin')
    expect(toks[0].kind).toBe('IDENTIFIER')
    expect(toks[0].value).toBe('admin')
  })
  it('tokenises a snake_case identifier: owner_id', () => {
    const toks = lex('owner_id')
    expect(toks[0].kind).toBe('IDENTIFIER')
    expect(toks[0].value).toBe('owner_id')
  })
  it('tokenises a wildcard: *', () => {
    const toks = lex('*')
    expect(toks[0].kind).toBe('WILDCARD')
  })
  it('tokenises a dot-path: listing.owner_id as three tokens', () => {
    const toks = lex('listing.owner_id')
    expect(toks[0].value).toBe('listing')
    expect(toks[1].value).toBe('.')
    expect(toks[2].value).toBe('owner_id')
  })
})

describe('Lexer — literals', () => {
  it('tokenises a double-quoted string', () => {
    const toks = lex('"public"')
    expect(toks[0].kind).toBe('STRING')
    expect(toks[0].value).toBe('public')
  })
  it('tokenises a single-quoted string', () => {
    const toks = lex("'draft'")
    expect(toks[0].kind).toBe('STRING')
    expect(toks[0].value).toBe('draft')
  })
  it('tokenises an integer', () => {
    const toks = lex('42')
    expect(toks[0].kind).toBe('NUMBER')
    expect(toks[0].value).toBe('42')
  })
  it('tokenises a float', () => {
    const toks = lex('3.14')
    expect(toks[0].kind).toBe('NUMBER')
    expect(toks[0].value).toBe('3.14')
  })
  it('tokenises boolean true', () => {
    const toks = lex('true')
    expect(toks[0].kind).toBe('BOOLEAN')
    expect(toks[0].value).toBe('true')
  })
  it('tokenises boolean false', () => {
    const toks = lex('false')
    expect(toks[0].kind).toBe('BOOLEAN')
    expect(toks[0].value).toBe('false')
  })
})

describe('Lexer — operators', () => {
  it('tokenises ==', () => { expect(kinds(lex('=='))).toContain('OP_EQ') })
  it('tokenises !=', () => { expect(kinds(lex('!='))).toContain('OP_NEQ') })
  it('tokenises >',  () => { expect(kinds(lex('>'))).toContain('OP_GT') })
  it('tokenises >=', () => { expect(kinds(lex('>='))).toContain('OP_GTE') })
  it('tokenises <',  () => { expect(kinds(lex('<'))).toContain('OP_LT') })
  it('tokenises <=', () => { expect(kinds(lex('<='))).toContain('OP_LTE') })
  it('tokenises AND', () => { expect(kinds(lex('AND'))).toContain('LOGICAL_AND') })
  it('tokenises OR',  () => { expect(kinds(lex('OR'))).toContain('LOGICAL_OR') })
  it('tokenises NOT', () => { expect(kinds(lex('NOT'))).toContain('LOGICAL_NOT') })
  it('>= is not parsed as > followed by =', () => {
    const toks = lex('>=')
    expect(toks[0].kind).toBe('OP_GTE')
    expect(toks).toHaveLength(2) // OP_GTE + EOF
  })
  it('<= is not parsed as < followed by =', () => {
    const toks = lex('<=')
    expect(toks[0].kind).toBe('OP_LTE')
    expect(toks).toHaveLength(2)
  })
})

describe('Lexer — line and column tracking', () => {
  it('tracks line number correctly across newlines', () => {
    const toks = lex('rule\nend')
    const endTok = toks.find(t => t.kind === 'KEYWORD_END')!
    expect(endTok.line).toBe(2)
  })
  it('tracks column number correctly within a line', () => {
    const toks = lex('rule end')
    const endTok = toks.find(t => t.kind === 'KEYWORD_END')!
    expect(endTok.column).toBe(6)
  })
  it('resets column to 1 after newline', () => {
    const toks = lex('rule\nend')
    const endTok = toks.find(t => t.kind === 'KEYWORD_END')!
    expect(endTok.column).toBe(1)
  })
  it('EOF token has a position', () => {
    const toks = lex('rule')
    const eof = toks[toks.length - 1]
    expect(eof.kind).toBe('EOF')
    expect(typeof eof.line).toBe('number')
    expect(typeof eof.column).toBe('number')
  })
})

describe('Lexer — comments', () => {
  it('skips # line comments', () => {
    const toks = lex('# this is a comment')
    expect(toks).toHaveLength(1) // only EOF
    expect(toks[0].kind).toBe('EOF')
  })
  it('comment at end of line does not consume next line content', () => {
    const toks = lex('rule # comment\nend')
    expect(kinds(toks)).toContain('KEYWORD_RULE')
    expect(kinds(toks)).toContain('KEYWORD_END')
  })
  it('inline comment after value strips only to end of line', () => {
    const toks = lex('admin # the admin role')
    expect(toks[0].value).toBe('admin')
  })
})

describe('Lexer — whitespace', () => {
  it('ignores leading and trailing whitespace on a line', () => {
    const toks = lex('  rule  ')
    expect(toks[0].kind).toBe('KEYWORD_RULE')
  })
  it('handles CRLF line endings', () => {
    const toks = lex('rule\r\nend')
    expect(kinds(toks)).toContain('KEYWORD_RULE')
    expect(kinds(toks)).toContain('KEYWORD_END')
    const endTok = toks.find(t => t.kind === 'KEYWORD_END')!
    expect(endTok.line).toBe(2)
  })
  it('handles empty lines', () => {
    const toks = lex('rule\n\n\nend')
    expect(kinds(toks)).toContain('KEYWORD_RULE')
    expect(kinds(toks)).toContain('KEYWORD_END')
  })
  it('handles a file with only whitespace', () => {
    const toks = lex('   \t  ')
    expect(toks).toHaveLength(1)
    expect(toks[0].kind).toBe('EOF')
  })
})

describe('Lexer — error cases', () => {
  it('throws ParseError with line and column on unknown character', () => {
    const err = (() => { try { lex('@invalid') } catch(e) { return e } })()
    expect(err).toBeInstanceOf(ParseError)
    expect((err as ParseError).line).toBe(1)
    expect((err as ParseError).column).toBe(1)
  })
  it('ParseError message includes the offending character', () => {
    const err = (() => { try { lex('@') } catch(e) { return e } })()
    expect((err as ParseError).message).toContain('@')
  })
  it('ParseError includes sourcePath', () => {
    const err = (() => { try { tokenize('@', 'my-policy.toon') } catch(e) { return e } })()
    expect((err as ParseError).sourcePath).toBe('my-policy.toon')
  })
  it('throws on unterminated string literal', () => {
    expect(() => lex('"unterminated')).toThrow(ParseError)
  })
  it('throws on unterminated single-quoted string', () => {
    expect(() => lex("'unterminated")).toThrow(ParseError)
  })
  it('throws on string spanning a newline', () => {
    expect(() => lex('"hello\nworld"')).toThrow(ParseError)
  })
})

describe('Lexer — edge cases', () => {
  it('handles empty string input → [EOF]', () => {
    const toks = lex('')
    expect(toks).toHaveLength(1)
    expect(toks[0].kind).toBe('EOF')
  })
  it('handles file with only comments → [EOF]', () => {
    const toks = lex('# comment only\n# another comment')
    expect(toks).toHaveLength(1)
    expect(toks[0].kind).toBe('EOF')
  })
  it('handles unicode characters in string literals', () => {
    const toks = lex('"héllo wörld"')
    expect(toks[0].kind).toBe('STRING')
    expect(toks[0].value).toBe('héllo wörld')
  })
  it('does not emit duplicate consecutive NEWLINEs', () => {
    const toks = lex('rule\n\n\nend')
    const newlines = toks.filter(t => t.kind === 'NEWLINE')
    expect(newlines.length).toBe(1)
  })
})
