import type { Token } from './types/ast.js'
import { ParseError } from './errors.js'

// ─── Lexer ───────────────────────────────────────────────────────────────────
// Phase 2 implementation target.
// Converts raw .toon source text into a flat Token[] stream.
// Tracks line + column for every token to enable precise error reporting.
// No dependencies — hand-written, zero runtime cost.
// ─────────────────────────────────────────────────────────────────────────────

export function tokenize(source: string, sourcePath: string): Token[] {
  void source
  void sourcePath
  throw new ParseError({
    message: 'Lexer not yet implemented (Phase 2)',
    line: 1,
    column: 1,
    sourcePath,
  })
}
