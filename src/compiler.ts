import type { PolicyDocument, RuleNode, ConditionExpr } from './types/ast.js'
import { CompileError } from './errors.js'

// ─── Compiled structures ─────────────────────────────────────────────────────

/**
 * A single rule after compilation.
 * The condition is stored as a pre-parsed AST node — never a string.
 * Deny rules are separated from allow rules at compile time.
 */
export interface CompiledRule {
  readonly role: string
  readonly action: string | '*'
  readonly resource: string | '*'
  readonly effect: 'allow' | 'deny'
  readonly condition: ConditionExpr | null
  readonly sourceLine: number
}

/**
 * The compiled policy index.
 * Structure: role → action → resource → CompiledRule[]
 * Wildcard '*' entries are stored under the literal key '*'.
 * Role hierarchies are fully expanded at compile time — no runtime traversal.
 */
export type PolicyIndex = Map<string, Map<string, Map<string, CompiledRule[]>>>

export interface CompiledPolicy {
  readonly index: PolicyIndex
  readonly sourcePath: string
}

// ─── Compiler ────────────────────────────────────────────────────────────────
// Phase 3 implementation target.
// Transforms a PolicyDocument AST into a CompiledPolicy for O(1) lookups.
// Role hierarchies are expanded here — zero cost at authorization time.
// Detects cycles in role_hierarchy and throws CompileError.
// ─────────────────────────────────────────────────────────────────────────────

export function compile(doc: PolicyDocument): CompiledPolicy {
  void doc
  throw new CompileError({
    message: 'Compiler not yet implemented (Phase 3)',
    sourcePath: doc.sourcePath,
  })
}

// ─── Internal helpers (stubs) ────────────────────────────────────────────────

export function _expandHierarchy(
  _entries: PolicyDocument['nodes'],
  _rules: RuleNode[],
  _sourcePath: string,
): RuleNode[] {
  throw new CompileError({
    message: '_expandHierarchy not yet implemented (Phase 3)',
    sourcePath: _sourcePath,
  })
}

export function _detectCycles(
  _graph: Map<string, string[]>,
  _sourcePath: string,
): void {
  throw new CompileError({
    message: '_detectCycles not yet implemented (Phase 3)',
    sourcePath: _sourcePath,
  })
}
