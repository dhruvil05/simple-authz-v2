// ─── Subject ────────────────────────────────────────────────────────────────

/**
 * The authenticated subject performing an action.
 * `roles` must be a non-empty array of role name strings.
 */
export interface User {
  readonly id: string | number
  readonly roles: readonly string[]
  readonly [key: string]: unknown
}

// ─── Authz options ──────────────────────────────────────────────────────────

export interface AuthzOptions {
  /**
   * Called after every authorization decision.
   * Errors thrown inside are swallowed — never propagated to the caller.
   */
  readonly audit?: (record: AuditRecord) => void | Promise<void>

  /**
   * Maximum nesting depth for user/resource objects passed into conditions.
   * Defaults to 10. Protects against DoS via deeply nested objects.
   */
  readonly maxContextDepth?: number
}

// ─── Decision result ────────────────────────────────────────────────────────

export type DecisionReason =
  | 'allow-rule-matched'
  | 'deny-rule-matched'
  | 'condition-failed'
  | 'no-matching-rule'
  | 'wildcard-matched'

export interface AuthzResult {
  readonly allowed: boolean
  readonly reason: DecisionReason
  readonly matchedRole?: string
  readonly matchedAction?: string
  readonly matchedResource?: string
  readonly conditionResult?: boolean
  readonly durationMs: number
}

// ─── Audit record ───────────────────────────────────────────────────────────

export interface AuditRecord {
  readonly allowed: boolean
  readonly userId: string | number
  readonly roles: readonly string[]
  readonly action: string
  readonly resource: string
  readonly reason: DecisionReason
  readonly durationMs: number
  readonly timestamp: number
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface ValidationResult {
  readonly valid: boolean
  readonly errors: readonly PolicyError[]
}

export interface PolicyError {
  readonly message: string
  readonly line: number
  readonly column: number
  readonly source?: string
}
