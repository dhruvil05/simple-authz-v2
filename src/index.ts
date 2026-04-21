// ─── simple-authz-v2 public API ─────────────────────────────────────────────────

export { Authz } from './authz.js'

// Errors
export {
  AuthzError,
  ParseError,
  CompileError,
  EvaluationError,
  PathSafetyError,
  ContextError,
} from './errors.js'

// Public types
export type {
  User,
  AuthzOptions,
  AuthzResult,
  AuditRecord,
  ValidationResult,
  PolicyError,
  DecisionReason,
} from './types/public.js'

// AST types — exported for consumers who want to build tooling on top
export type {
  PolicyDocument,
  RuleNode,
  RoleHierarchyNode,
  IncludeNode,
  ConditionExpr,
  BinaryExpr,
  UnaryExpr,
  PathExpr,
  LiteralExpr,
  Token,
  TokenKind,
  Effect,
  ComparisonOperator,
} from './types/ast.js'
