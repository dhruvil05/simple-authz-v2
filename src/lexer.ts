import type { Token, TokenKind } from './types/ast.js'
import { ParseError } from './errors.js'

// ─── Keyword map ─────────────────────────────────────────────────────────────

const KEYWORDS: ReadonlyMap<string, TokenKind> = new Map([
  ['rule', 'KEYWORD_RULE'],
  ['end', 'KEYWORD_END'],
  ['role', 'KEYWORD_ROLE'],
  ['action', 'KEYWORD_ACTION'],
  ['resource', 'KEYWORD_RESOURCE'],
  ['condition', 'KEYWORD_CONDITION'],
  ['effect', 'KEYWORD_EFFECT'],
  ['include', 'KEYWORD_INCLUDE'],
  ['role_hierarchy', 'KEYWORD_ROLE_HIERARCHY'],
  ['extends', 'KEYWORD_EXTENDS'],
  ['AND', 'LOGICAL_AND'],
  ['OR', 'LOGICAL_OR'],
  ['NOT', 'LOGICAL_NOT'],
  ['allow', 'IDENTIFIER'],
  ['deny', 'IDENTIFIER'],
  ['true', 'BOOLEAN'],
  ['false', 'BOOLEAN'],
  ['null', 'IDENTIFIER'],
])

// ─── Lexer state ─────────────────────────────────────────────────────────────

interface LexerState {
  readonly source: string
  readonly sourcePath: string
  pos: number
  line: number
  col: number
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function tokenize(source: string, sourcePath: string): Token[] {
  const state: LexerState = { source, sourcePath, pos: 0, line: 1, col: 1 }
  const tokens: Token[] = []

  while (state.pos < state.source.length) {
    skipWhitespaceAndComments(state)
    if (state.pos >= state.source.length) break

    const ch = state.source[state.pos]!

    if (ch === '\r' || ch === '\n') {
      tokens.push(readNewline(state))
      continue
    }

    if (isDigit(ch)) {
      tokens.push(readNumber(state))
      continue
    }

    if (ch === '"' || ch === "'") {
      tokens.push(readString(state))
      continue
    }

    const opToken = tryReadOperator(state)
    if (opToken !== null) {
      tokens.push(opToken)
      continue
    }

    if (isIdentStart(ch)) {
      tokens.push(readIdentifierOrKeyword(state))
      continue
    }

    throw new ParseError({
      message: `unexpected character ${JSON.stringify(ch)}`,
      line: state.line,
      column: state.col,
      sourcePath,
    })
  }

  const deduped = deduplicateNewlines(tokens)
  deduped.push({ kind: 'EOF', value: '', line: state.line, column: state.col })
  return deduped
}

// ─── Skip whitespace and comments ────────────────────────────────────────────

function skipWhitespaceAndComments(state: LexerState): void {
  while (state.pos < state.source.length) {
    const ch = state.source[state.pos]!
    if (ch === ' ' || ch === '\t') { advance(state); continue }
    if (ch === '#') {
      while (
        state.pos < state.source.length &&
        state.source[state.pos] !== '\n' &&
        state.source[state.pos] !== '\r'
      ) advance(state)
      continue
    }
    break
  }
}

// ─── Read newline ─────────────────────────────────────────────────────────────

function readNewline(state: LexerState): Token {
  const line = state.line
  const col = state.col
  if (
    state.source[state.pos] === '\r' &&
    state.pos + 1 < state.source.length &&
    state.source[state.pos + 1] === '\n'
  ) {
    state.pos += 2
  } else {
    state.pos += 1
  }
  state.line += 1
  state.col = 1
  return { kind: 'NEWLINE', value: '\n', line, column: col }
}

// ─── Read number ──────────────────────────────────────────────────────────────

function readNumber(state: LexerState): Token {
  const line = state.line
  const col = state.col
  let value = ''
  while (state.pos < state.source.length && isDigit(state.source[state.pos]!)) {
    value += state.source[state.pos]; advance(state)
  }
  if (
    state.pos < state.source.length &&
    state.source[state.pos] === '.' &&
    state.pos + 1 < state.source.length &&
    isDigit(state.source[state.pos + 1]!)
  ) {
    value += '.'; advance(state)
    while (state.pos < state.source.length && isDigit(state.source[state.pos]!)) {
      value += state.source[state.pos]; advance(state)
    }
  }
  return { kind: 'NUMBER', value, line, column: col }
}

// ─── Read string ──────────────────────────────────────────────────────────────

function readString(state: LexerState): Token {
  const line = state.line
  const col = state.col
  const quote = state.source[state.pos]!
  advance(state)
  let value = ''
  while (state.pos < state.source.length) {
    const ch = state.source[state.pos]!
    if (ch === '\n' || ch === '\r') {
      throw new ParseError({ message: 'unterminated string literal', line, column: col, sourcePath: state.sourcePath })
    }
    if (ch === quote) { advance(state); return { kind: 'STRING', value, line, column: col } }
    if (ch === '\\') {
      advance(state)
      if (state.pos >= state.source.length) {
        throw new ParseError({ message: 'unterminated escape sequence', line: state.line, column: state.col, sourcePath: state.sourcePath })
      }
      const esc = state.source[state.pos]!
      switch (esc) {
        case '"':  value += '"';  break
        case "'":  value += "'";  break
        case '\\': value += '\\'; break
        case 'n':  value += '\n'; break
        case 't':  value += '\t'; break
        default:
          throw new ParseError({ message: `unknown escape sequence \\${esc}`, line: state.line, column: state.col, sourcePath: state.sourcePath })
      }
      advance(state); continue
    }
    value += ch; advance(state)
  }
  throw new ParseError({ message: 'unterminated string literal — reached end of file', line, column: col, sourcePath: state.sourcePath })
}

// ─── Read operator / punctuation ─────────────────────────────────────────────

function tryReadOperator(state: LexerState): Token | null {
  const line = state.line
  const col = state.col
  const ch = state.source[state.pos]!
  const next = state.source[state.pos + 1]

  if (ch === '=' && next === '=') { state.pos += 2; state.col += 2; return { kind: 'OP_EQ',  value: '==', line, column: col } }
  if (ch === '!' && next === '=') { state.pos += 2; state.col += 2; return { kind: 'OP_NEQ', value: '!=', line, column: col } }
  if (ch === '>' && next === '=') { state.pos += 2; state.col += 2; return { kind: 'OP_GTE', value: '>=', line, column: col } }
  if (ch === '<' && next === '=') { state.pos += 2; state.col += 2; return { kind: 'OP_LTE', value: '<=', line, column: col } }
  if (ch === '>') { advance(state); return { kind: 'OP_GT',  value: '>',  line, column: col } }
  if (ch === '<') { advance(state); return { kind: 'OP_LT',  value: '<',  line, column: col } }
  if (ch === '*') { advance(state); return { kind: 'WILDCARD',     value: '*', line, column: col } }
  if (ch === '(') { advance(state); return { kind: 'PAREN_OPEN',   value: '(', line, column: col } }
  if (ch === ')') { advance(state); return { kind: 'PAREN_CLOSE',  value: ')', line, column: col } }
  if (ch === ',') { advance(state); return { kind: 'IDENTIFIER',   value: ',', line, column: col } }
  if (ch === '.') { advance(state); return { kind: 'IDENTIFIER',   value: '.', line, column: col } }
  return null
}

// ─── Read identifier or keyword ───────────────────────────────────────────────

function readIdentifierOrKeyword(state: LexerState): Token {
  const line = state.line
  const col = state.col
  let value = ''
  while (state.pos < state.source.length && isIdentContinue(state.source[state.pos]!)) {
    value += state.source[state.pos]; advance(state)
  }
  const kind = KEYWORDS.get(value) ?? 'IDENTIFIER'
  return { kind, value, line, column: col }
}

// ─── Deduplicate consecutive newlines ─────────────────────────────────────────

function deduplicateNewlines(tokens: Token[]): Token[] {
  const result: Token[] = []
  let lastWasNewline = true
  for (const tok of tokens) {
    if (tok.kind === 'NEWLINE') {
      if (!lastWasNewline) { result.push(tok); lastWasNewline = true }
    } else {
      result.push(tok); lastWasNewline = false
    }
  }
  if (result.length > 0 && result[result.length - 1]!.kind === 'NEWLINE') result.pop()
  return result
}

// ─── Character helpers ────────────────────────────────────────────────────────

function isDigit(ch: string): boolean { return ch >= '0' && ch <= '9' }
function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
}
function isIdentContinue(ch: string): boolean { return isIdentStart(ch) || isDigit(ch) }
function advance(state: LexerState): void { state.pos += 1; state.col += 1 }
