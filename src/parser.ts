import type { Token } from './types/ast.js'
import type { PolicyDocument } from './types/ast.js'
import { ParseError } from './errors.js'

// ─── Parser ──────────────────────────────────────────────────────────────────
// Phase 2 implementation target.
// Recursive-descent parser. Consumes Token[] and produces a PolicyDocument AST.
// All AST nodes are readonly — no mutation after construction.
// Throws ParseError with line + column on any syntax violation.
// ─────────────────────────────────────────────────────────────────────────────

export function parse(tokens: Token[], sourcePath: string): PolicyDocument {
  void tokens
  throw new ParseError({
    message: 'Parser not yet implemented (Phase 2)',
    line: 1,
    column: 1,
    sourcePath,
  })
}
