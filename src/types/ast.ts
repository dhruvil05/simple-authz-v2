// ─── Token types ─────────────────────────────────────────────────────────────

export type TokenKind =
  | 'KEYWORD_RULE'
  | 'KEYWORD_END'
  | 'KEYWORD_ROLE'
  | 'KEYWORD_ACTION'
  | 'KEYWORD_RESOURCE'
  | 'KEYWORD_CONDITION'
  | 'KEYWORD_EFFECT'
  | 'KEYWORD_INCLUDE'
  | 'KEYWORD_ROLE_HIERARCHY'
  | 'KEYWORD_EXTENDS'
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'WILDCARD'
  | 'OP_EQ'
  | 'OP_NEQ'
  | 'OP_GT'
  | 'OP_GTE'
  | 'OP_LT'
  | 'OP_LTE'
  | 'LOGICAL_AND'
  | 'LOGICAL_OR'
  | 'LOGICAL_NOT'
  | 'PAREN_OPEN'
  | 'PAREN_CLOSE'
  | 'NEWLINE'
  | 'EOF'

export interface Token {
  readonly kind: TokenKind
  readonly value: string
  readonly line: number
  readonly column: number
}

// ─── Effect ──────────────────────────────────────────────────────────────────

export type Effect = 'allow' | 'deny'

// ─── Condition expression nodes ──────────────────────────────────────────────

export type ComparisonOperator = '==' | '!=' | '>' | '>=' | '<' | '<='

export interface BinaryExpr {
  readonly kind: 'BinaryExpr'
  readonly left: ConditionExpr
  readonly operator: ComparisonOperator | 'AND' | 'OR'
  readonly right: ConditionExpr
}

export interface UnaryExpr {
  readonly kind: 'UnaryExpr'
  readonly operator: 'NOT'
  readonly operand: ConditionExpr
}

/** Dot-notation path: user.id, resource.owner_id, ctx.tenant */
export interface PathExpr {
  readonly kind: 'PathExpr'
  readonly segments: readonly string[]
}

export interface LiteralExpr {
  readonly kind: 'LiteralExpr'
  readonly value: string | number | boolean | null
}

export type ConditionExpr = BinaryExpr | UnaryExpr | PathExpr | LiteralExpr

// ─── Rule node ───────────────────────────────────────────────────────────────

export interface RuleNode {
  readonly kind: 'RuleNode'
  readonly role: string
  readonly action: string | '*'
  readonly resource: string | '*'
  readonly effect: Effect
  readonly condition: ConditionExpr | null
  readonly line: number
}

// ─── Role hierarchy node ─────────────────────────────────────────────────────

export interface RoleHierarchyEntry {
  readonly role: string
  readonly extends: readonly string[]
}

export interface RoleHierarchyNode {
  readonly kind: 'RoleHierarchyNode'
  readonly entries: readonly RoleHierarchyEntry[]
  readonly line: number
}

// ─── Include directive ───────────────────────────────────────────────────────

export interface IncludeNode {
  readonly kind: 'IncludeNode'
  readonly path: string
  readonly line: number
}

// ─── Top-level document ──────────────────────────────────────────────────────

export type TopLevelNode = RuleNode | RoleHierarchyNode | IncludeNode

export interface PolicyDocument {
  readonly kind: 'PolicyDocument'
  readonly nodes: readonly TopLevelNode[]
  readonly sourcePath: string
}
