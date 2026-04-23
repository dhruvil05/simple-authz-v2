import type {
  Token, TokenKind,
  PolicyDocument, TopLevelNode,
  RuleNode, RoleHierarchyNode, RoleHierarchyEntry, IncludeNode,
  ConditionExpr, BinaryExpr, UnaryExpr, PathExpr, LiteralExpr,
  Effect,
} from './types/ast.js'
import { ParseError } from './errors.js'

// ─── Parser state ─────────────────────────────────────────────────────────────

interface ParserState {
  readonly tokens: Token[]
  readonly sourcePath: string
  pos: number
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parses a Token[] produced by the lexer into a PolicyDocument AST.
 * Throws ParseError (with line+col) on any syntax violation.
 */
export function parse(tokens: Token[], sourcePath: string): PolicyDocument {
  if (tokens.length === 0) {
    throw new ParseError({
      message: 'unexpected empty token stream — expected policy content or EOF',
      line: 1, column: 1, sourcePath,
    })
  }

  const state: ParserState = { tokens, sourcePath, pos: 0 }
  const nodes: TopLevelNode[] = []

  // Consume leading newlines
  while (peek(state).kind === 'NEWLINE') consume(state)

  while (peek(state).kind !== 'EOF') {
    nodes.push(parseTopLevel(state))
    // Consume separating newlines between top-level declarations
    while (peek(state).kind === 'NEWLINE') consume(state)
  }

  return { kind: 'PolicyDocument', nodes, sourcePath }
}

// ─── Top-level dispatch ───────────────────────────────────────────────────────

function parseTopLevel(state: ParserState): TopLevelNode {
  const tok = peek(state)
  switch (tok.kind) {
    case 'KEYWORD_RULE':           return parseRuleBlock(state)
    case 'KEYWORD_ROLE_HIERARCHY': return parseRoleHierarchyBlock(state)
    case 'KEYWORD_INCLUDE':        return parseIncludeDirective(state)
    default:
      throw new ParseError({
        message: `unexpected token ${JSON.stringify(tok.value)} — expected "rule", "role_hierarchy", or "include"`,
        line: tok.line, column: tok.column, sourcePath: state.sourcePath,
      })
  }
}

// ─── Rule block ───────────────────────────────────────────────────────────────

function parseRuleBlock(state: ParserState): RuleNode {
  const ruleTok = expect(state, 'KEYWORD_RULE')
  expectNewline(state)

  let role: string | null = null
  let action: string | null = null
  let resource: string | null = null
  let effect: Effect = 'allow'
  let condition: ConditionExpr | null = null

  // Parse statements until we see "end"
  while (peek(state).kind !== 'KEYWORD_END') {
    if (peek(state).kind === 'EOF') {
      throw new ParseError({
        message: 'unexpected end of file inside rule block — missing "end"',
        line: ruleTok.line, column: ruleTok.column, sourcePath: state.sourcePath,
      })
    }

    // Skip blank lines inside blocks
    if (peek(state).kind === 'NEWLINE') { consume(state); continue }

    const stmtTok = peek(state)
    switch (stmtTok.kind) {
      case 'KEYWORD_ROLE': {
        if (role !== null) throw duplicateStmt(state, 'role')
        consume(state) // consume 'role'
        role = expectIdentifier(state, 'role name')
        expectNewline(state)
        break
      }
      case 'KEYWORD_ACTION': {
        if (action !== null) throw duplicateStmt(state, 'action')
        consume(state)
        action = expectIdentifierOrWildcard(state, 'action name')
        expectNewline(state)
        break
      }
      case 'KEYWORD_RESOURCE': {
        if (resource !== null) throw duplicateStmt(state, 'resource')
        consume(state)
        resource = expectIdentifierOrWildcard(state, 'resource name')
        expectNewline(state)
        break
      }
      case 'KEYWORD_EFFECT': {
        consume(state)
        const effTok = peek(state)
        if (effTok.value !== 'allow' && effTok.value !== 'deny') {
          throw new ParseError({
            message: `expected "allow" or "deny" after "effect", got ${JSON.stringify(effTok.value)}`,
            line: effTok.line, column: effTok.column, sourcePath: state.sourcePath,
          })
        }
        effect = effTok.value as Effect
        consume(state)
        expectNewline(state)
        break
      }
      case 'KEYWORD_CONDITION': {
        if (condition !== null) throw duplicateStmt(state, 'condition')
        consume(state)
        condition = parseConditionExpr(state)
        expectNewline(state)
        break
      }
      default:
        throw new ParseError({
          message: `unexpected token ${JSON.stringify(stmtTok.value)} inside rule block — expected role, action, resource, effect, condition, or end`,
          line: stmtTok.line, column: stmtTok.column, sourcePath: state.sourcePath,
        })
    }
  }

  expect(state, 'KEYWORD_END')
  if (peek(state).kind === 'NEWLINE' || peek(state).kind === 'EOF') {
    if (peek(state).kind === 'NEWLINE') consume(state)
  }

  // Validate required fields
  if (role === null) {
    throw new ParseError({
      message: 'rule block is missing required "role" statement',
      line: ruleTok.line, column: ruleTok.column, sourcePath: state.sourcePath,
    })
  }
  if (action === null) {
    throw new ParseError({
      message: 'rule block is missing required "action" statement',
      line: ruleTok.line, column: ruleTok.column, sourcePath: state.sourcePath,
    })
  }
  if (resource === null) {
    throw new ParseError({
      message: 'rule block is missing required "resource" statement',
      line: ruleTok.line, column: ruleTok.column, sourcePath: state.sourcePath,
    })
  }

  return {
    kind: 'RuleNode',
    role,
    action,
    resource,
    effect,
    condition,
    line: ruleTok.line,
  }
}

// ─── Role hierarchy block ─────────────────────────────────────────────────────

function parseRoleHierarchyBlock(state: ParserState): RoleHierarchyNode {
  const startTok = expect(state, 'KEYWORD_ROLE_HIERARCHY')
  expectNewline(state)

  const entries: RoleHierarchyEntry[] = []

  while (peek(state).kind !== 'KEYWORD_END') {
    if (peek(state).kind === 'EOF') {
      throw new ParseError({
        message: 'unexpected end of file inside role_hierarchy block — missing "end"',
        line: startTok.line, column: startTok.column, sourcePath: state.sourcePath,
      })
    }
    if (peek(state).kind === 'NEWLINE') { consume(state); continue }

    // Parse: IDENTIFIER "extends" IDENTIFIER { "," IDENTIFIER } NEWLINE
    const roleName = expectIdentifier(state, 'role name in hierarchy')
    expect(state, 'KEYWORD_EXTENDS')

    const parents: string[] = []
    parents.push(expectIdentifier(state, 'parent role name'))

    // Additional comma-separated parents
    while (peek(state).kind === 'IDENTIFIER' && peek(state).value === ',') {
      consume(state) // consume ','
      parents.push(expectIdentifier(state, 'parent role name'))
    }

    expectNewline(state)
    entries.push({ role: roleName, extends: parents })
  }

  expect(state, 'KEYWORD_END')
  if (peek(state).kind === 'NEWLINE') consume(state)

  return { kind: 'RoleHierarchyNode', entries, line: startTok.line }
}

// ─── Include directive ────────────────────────────────────────────────────────

function parseIncludeDirective(state: ParserState): IncludeNode {
  const startTok = expect(state, 'KEYWORD_INCLUDE')
  const pathTok = peek(state)
  if (pathTok.kind !== 'STRING') {
    throw new ParseError({
      message: `expected a string path after "include", got ${JSON.stringify(pathTok.value)}`,
      line: pathTok.line, column: pathTok.column, sourcePath: state.sourcePath,
    })
  }
  consume(state)
  expectNewline(state)
  return { kind: 'IncludeNode', path: pathTok.value, line: startTok.line }
}

// ─── Condition expression parsing (Pratt-style precedence) ───────────────────

function parseConditionExpr(state: ParserState): ConditionExpr {
  return parseOrExpr(state)
}

// or_expr = and_expr { "OR" and_expr }
function parseOrExpr(state: ParserState): ConditionExpr {
  let left = parseAndExpr(state)
  while (peek(state).kind === 'LOGICAL_OR') {
    consume(state) // consume 'OR'
    const right = parseAndExpr(state)
    const expr: BinaryExpr = { kind: 'BinaryExpr', operator: 'OR', left, right }
    left = expr
  }
  return left
}

// and_expr = not_expr { "AND" not_expr }
function parseAndExpr(state: ParserState): ConditionExpr {
  let left = parseNotExpr(state)
  while (peek(state).kind === 'LOGICAL_AND') {
    consume(state) // consume 'AND'
    const right = parseNotExpr(state)
    const expr: BinaryExpr = { kind: 'BinaryExpr', operator: 'AND', left, right }
    left = expr
  }
  return left
}

// not_expr = "NOT" not_expr | comparison_expr
function parseNotExpr(state: ParserState): ConditionExpr {
  if (peek(state).kind === 'LOGICAL_NOT') {
    consume(state) // consume 'NOT'
    const operand = parseNotExpr(state) // right-associative
    const expr: UnaryExpr = { kind: 'UnaryExpr', operator: 'NOT', operand }
    return expr
  }
  return parseComparisonExpr(state)
}

// comparison_expr = atom [comparison_op atom]
function parseComparisonExpr(state: ParserState): ConditionExpr {
  const left = parseAtom(state)

  const opKind = peek(state).kind
  if (
    opKind === 'OP_EQ'  || opKind === 'OP_NEQ' ||
    opKind === 'OP_GT'  || opKind === 'OP_GTE' ||
    opKind === 'OP_LT'  || opKind === 'OP_LTE'
  ) {
    const opTok = consume(state)
    const right = parseAtom(state)
    const operator = opTok.value as BinaryExpr['operator']
    const expr: BinaryExpr = { kind: 'BinaryExpr', operator, left, right }
    return expr
  }

  return left
}

// atom = path_expr | literal_expr | "(" condition_expr ")"
function parseAtom(state: ParserState): ConditionExpr {
  const tok = peek(state)

  // Parenthesised group
  if (tok.kind === 'PAREN_OPEN') {
    consume(state) // consume '('
    const inner = parseConditionExpr(state)
    const closeTok = peek(state)
    if (closeTok.kind !== 'PAREN_CLOSE') {
      throw new ParseError({
        message: `expected ")" to close grouped expression, got ${JSON.stringify(closeTok.value)}`,
        line: closeTok.line, column: closeTok.column, sourcePath: state.sourcePath,
      })
    }
    consume(state) // consume ')'
    return inner
  }

  // Literals
  if (tok.kind === 'STRING') {
    consume(state)
    const expr: LiteralExpr = { kind: 'LiteralExpr', value: tok.value }
    return expr
  }
  if (tok.kind === 'NUMBER') {
    consume(state)
    const expr: LiteralExpr = { kind: 'LiteralExpr', value: parseFloat(tok.value) }
    return expr
  }
  if (tok.kind === 'BOOLEAN') {
    consume(state)
    const expr: LiteralExpr = { kind: 'LiteralExpr', value: tok.value === 'true' }
    return expr
  }
  // null literal — emitted as IDENTIFIER with value 'null'
  if (tok.kind === 'IDENTIFIER' && tok.value === 'null') {
    consume(state)
    const expr: LiteralExpr = { kind: 'LiteralExpr', value: null }
    return expr
  }

  // Path expression — root variables: user (IDENTIFIER), resource (KEYWORD_RESOURCE), ctx (IDENTIFIER)
  // 'resource' is lexed as KEYWORD_RESOURCE because it is a reserved keyword.
  // We allow it here as a path root and validate it inside parsePathExpr.
  if (tok.kind === 'IDENTIFIER' || tok.kind === 'KEYWORD_RESOURCE') {
    return parsePathExpr(state)
  }

  throw new ParseError({
    message: `unexpected token ${JSON.stringify(tok.value)} in condition expression — expected a path (user.x), literal, or "("`,
    line: tok.line, column: tok.column, sourcePath: state.sourcePath,
  })
}

// path_expr = root_variable { "." IDENTIFIER }
// 'resource' is KEYWORD_RESOURCE; 'user' and 'ctx' are IDENTIFIERs.
// The lexer emits '.' as IDENTIFIER with value '.'.
function parsePathExpr(state: ParserState): PathExpr {
  const firstTok = peek(state)
  const segments: string[] = []
  // Accept both IDENTIFIER and KEYWORD_RESOURCE as the first token
  if (firstTok.kind === 'KEYWORD_RESOURCE') {
    segments.push('resource')
    consume(state)
  } else {
    segments.push(expectIdentifier(state, 'path root (user, resource, or ctx)'))
  }

  // Consume dot-separated segments
  while (peek(state).kind === 'IDENTIFIER' && peek(state).value === '.') {
    consume(state) // consume '.'
    segments.push(expectIdentifier(state, 'path segment'))
  }

  // SE-06: first segment must be a valid root variable
  const root = segments[0]
  if (root !== 'user' && root !== 'resource' && root !== 'ctx') {
    throw new ParseError({
      message: `invalid path root "${root}" — must be "user", "resource", or "ctx"`,
      line: firstTok.line, column: firstTok.column, sourcePath: state.sourcePath,
    })
  }

  return { kind: 'PathExpr', segments }
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function peek(state: ParserState): Token {
  return state.tokens[state.pos] ?? { kind: 'EOF', value: '', line: 0, column: 0 }
}

function consume(state: ParserState): Token {
  const tok = state.tokens[state.pos]
  state.pos += 1
  return tok!
}

function expect(state: ParserState, kind: TokenKind): Token {
  const tok = peek(state)
  if (tok.kind !== kind) {
    throw new ParseError({
      message: `expected ${JSON.stringify(kind)}, got ${JSON.stringify(tok.value)} (${tok.kind})`,
      line: tok.line, column: tok.column, sourcePath: state.sourcePath,
    })
  }
  return consume(state)
}

function expectNewline(state: ParserState): void {
  const tok = peek(state)
  if (tok.kind === 'EOF') return // EOF is fine at end of block
  if (tok.kind !== 'NEWLINE') {
    throw new ParseError({
      message: `expected newline, got ${JSON.stringify(tok.value)}`,
      line: tok.line, column: tok.column, sourcePath: state.sourcePath,
    })
  }
  consume(state)
}

function expectIdentifier(state: ParserState, what: string): string {
  const tok = peek(state)
  if (tok.kind !== 'IDENTIFIER' || tok.value === '.' || tok.value === ',') {
    throw new ParseError({
      message: `expected ${what}, got ${JSON.stringify(tok.value)}`,
      line: tok.line, column: tok.column, sourcePath: state.sourcePath,
    })
  }
  consume(state)
  return tok.value
}

function expectIdentifierOrWildcard(state: ParserState, what: string): string {
  const tok = peek(state)
  if (tok.kind === 'WILDCARD') { consume(state); return '*' }
  return expectIdentifier(state, what)
}

function duplicateStmt(state: ParserState, name: string): ParseError {
  const tok = peek(state)
  return new ParseError({
    message: `duplicate "${name}" statement in rule block`,
    line: tok.line, column: tok.column, sourcePath: state.sourcePath,
  })
}
