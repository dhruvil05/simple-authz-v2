import { describe, it, expect } from 'vitest'
import { tokenize } from '../../src/lexer.js'
import { ParseError } from '../../src/errors.js'

describe('Lexer', () => {
  describe('keywords', () => {
    it.todo('tokenises "rule" keyword')
    it.todo('tokenises "end" keyword')
    it.todo('tokenises "role" keyword')
    it.todo('tokenises "action" keyword')
    it.todo('tokenises "resource" keyword')
    it.todo('tokenises "condition" keyword')
    it.todo('tokenises "effect" keyword')
    it.todo('tokenises "include" keyword')
    it.todo('tokenises "role_hierarchy" keyword')
    it.todo('tokenises "extends" keyword')
    it.todo('keywords are case-sensitive — RULE is not a keyword')
  })

  describe('identifiers and wildcards', () => {
    it.todo('tokenises a simple identifier: admin')
    it.todo('tokenises a snake_case identifier: owner_id')
    it.todo('tokenises a wildcard: *')
    it.todo('tokenises a dot-path: listing.owner_id')
  })

  describe('literals', () => {
    it.todo('tokenises a double-quoted string: "public"')
    it.todo('tokenises a single-quoted string: \'draft\'')
    it.todo('tokenises an integer: 42')
    it.todo('tokenises a float: 3.14')
    it.todo('tokenises boolean true')
    it.todo('tokenises boolean false')
  })

  describe('operators', () => {
    it.todo('tokenises ==')
    it.todo('tokenises !=')
    it.todo('tokenises >')
    it.todo('tokenises >=')
    it.todo('tokenises <')
    it.todo('tokenises <=')
    it.todo('tokenises AND')
    it.todo('tokenises OR')
    it.todo('tokenises NOT')
  })

  describe('line and column tracking', () => {
    it.todo('tracks line number correctly across newlines')
    it.todo('tracks column number correctly within a line')
    it.todo('resets column to 1 after each newline')
    it.todo('EOF token has correct final position')
  })

  describe('comments', () => {
    it.todo('skips # line comments')
    it.todo('comment at end of line does not consume next line')
    it.todo('empty comment # produces no tokens')
  })

  describe('whitespace', () => {
    it.todo('ignores leading and trailing whitespace on a line')
    it.todo('handles CRLF line endings')
    it.todo('handles empty lines')
    it.todo('handles a file with only whitespace')
  })

  describe('error cases', () => {
    it('throws ParseError with line and column on unknown character', () => {
      expect(() => tokenize('@invalid', 'test.toon')).toThrow(ParseError)
    })

    it.todo('ParseError message includes the offending character')
    it.todo('ParseError has correct line number')
    it.todo('ParseError has correct column number')
    it.todo('ParseError includes sourcePath')
    it.todo('throws on unterminated string literal')
  })

  describe('edge cases', () => {
    it.todo('handles empty string input → [EOF]')
    it.todo('handles file with only comments → [EOF]')
    it.todo('handles unicode characters in string literals')
    it.todo('handles very long lines without performance degradation')
  })
})
